import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, CreditCard, CheckCircle, AlertCircle,
  X, Smartphone, Building2, Wallet, ArrowRight,
} from 'lucide-react';

interface Payment { amount: string; paymentDate: string; paymentMethod: string; receiptNumber: string; transactionRef?: string }
interface Invoice {
  id: string; invoiceNumber: string; totalAmount: string; paidAmount: string; discount?: string;
  status: string; dueDate?: string; createdAt: string;
  items: { description: string; amount: string }[];
  payments: Payment[];
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

const STATUS_COLOR: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
  PAID: 'success', OVERDUE: 'destructive', PENDING: 'warning', PARTIAL: 'warning', WAIVED: 'default',
};

const PAYMENT_OPTIONS = [
  { id: 'upi',        label: 'UPI',          sub: 'Google Pay · PhonePe · Paytm',  icon: Smartphone,  rzpMethod: 'upi'        },
  { id: 'card',       label: 'Debit / Credit Card', sub: 'Visa · Mastercard · RuPay', icon: CreditCard, rzpMethod: 'card'       },
  { id: 'netbanking', label: 'Net Banking',   sub: 'All major banks supported',      icon: Building2,   rzpMethod: 'netbanking' },
  { id: 'wallet',     label: 'Wallet',        sub: 'Paytm · Mobikwik · Freecharge',  icon: Wallet,      rzpMethod: 'wallet'     },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (document.getElementById('razorpay-checkout-js')) { resolve(true); return; }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function StudentFeesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payResult, setPayResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment method modal
  const [selectInvoice, setSelectInvoice] = useState<Invoice | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('upi');
  const [customAmount, setCustomAmount] = useState('');
  const [launching, setLaunching] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(() => {
    api.get('/fees/my-invoices')
      .then(r => setInvoices(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  const outstanding = invoices.reduce((acc, inv) => acc + Math.max(0, Number(inv.totalAmount) - Number(inv.discount ?? 0) - Number(inv.paidAmount)), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.paidAmount), 0);

  function toggle(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function showResult(type: 'success' | 'error', msg: string) {
    setPayResult({ type, msg });
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => setPayResult(null), type === 'success' ? 4000 : 6000);
  }

  function openPayModal(inv: Invoice) {
    const due = Math.max(0, Number(inv.totalAmount) - Number(inv.discount ?? 0) - Number(inv.paidAmount));
    setSelectInvoice(inv);
    setSelectedMethod('upi');
    setCustomAmount(due.toFixed(2));
    setModalError('');
  }

  async function handleProceedToPay() {
    if (!selectInvoice) return;
    const amount = parseFloat(customAmount);
    const due = Math.max(0, Number(selectInvoice.totalAmount) - Number(selectInvoice.discount ?? 0) - Number(selectInvoice.paidAmount));

    if (!amount || amount <= 0) { setModalError('Enter a valid amount.'); return; }
    if (amount > due + 0.01) { setModalError(`Amount cannot exceed the balance due of ${formatCurrency(due)}.`); return; }

    setLaunching(true);
    setModalError('');

    try {
      const { data } = await api.post('/fees/create-payment-order', { invoiceId: selectInvoice.id, amount });

      if (!data.data.razorpayEnabled) {
        setModalError('Online payment gateway is not configured. Please contact the school admin.');
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) throw new Error('Razorpay SDK failed to load. Check your internet connection.');

      const { orderId, amount: rzpAmount, currency, key } = data.data;
      const rzpMethod = PAYMENT_OPTIONS.find(o => o.id === selectedMethod)?.rzpMethod;
      const inv = selectInvoice;

      setSelectInvoice(null);

      await new Promise<void>((resolve, reject) => {
        const options: Record<string, unknown> = {
          key,
          amount: rzpAmount,
          currency,
          order_id: orderId,
          name: 'SAKA School Management',
          description: `Invoice ${inv.invoiceNumber}`,
          theme: { color: '#4F46E5' },
          method: rzpMethod,
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              await api.post('/fees/verify-payment', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                invoiceId: inv.id,
                amount,
              });
              showResult('success', `Payment of ${formatCurrency(amount)} successful! Your receipt has been generated.`);
              load();
              resolve();
            } catch (err: unknown) {
              reject(new Error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Payment verification failed'));
            }
          },
          modal: { ondismiss: () => reject(new Error('cancelled')) },
        };
        new window.Razorpay(options).open();
      });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg !== 'cancelled') {
        if (selectInvoice) {
          setModalError(msg || 'Payment failed. Please try again.');
        } else {
          showResult('error', msg || 'Payment failed. Please try again.');
        }
      }
    } finally {
      setLaunching(false);
    }
  }

  const canPay = (inv: Invoice) => inv.status !== 'PAID' && inv.status !== 'WAIVED';

  return (
    <div>
      <PageHeader title="My Fees" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Fees' }]} />

      {/* Result banner */}
      {payResult && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-4 text-sm font-medium border ${payResult.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {payResult.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {payResult.msg}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-red-600">{formatCurrency(outstanding)}</p>
            <p className="text-xs text-muted-foreground mt-1">Outstanding Balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-bold">{invoices.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Invoices</p>
          </CardContent>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No invoices found</p>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const due = Math.max(0, Number(inv.totalAmount) - Number(inv.discount ?? 0) - Number(inv.paidAmount));
            return (
              <Card key={inv.id}>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggle(inv.id)}>
                    {expanded.has(inv.id) ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inv.createdAt)}{inv.dueDate ? ` · Due: ${formatDate(inv.dueDate)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(Number(inv.totalAmount))}</p>
                      {due > 0 && <p className="text-xs text-red-500 font-medium">Due: {formatCurrency(due)}</p>}
                    </div>
                    <Badge variant={STATUS_COLOR[inv.status] ?? 'default'}>{inv.status}</Badge>
                    {canPay(inv) && (
                      <Button size="sm" onClick={() => openPayModal(inv)} className="shrink-0">
                        <CreditCard className="h-3.5 w-3.5 mr-1.5" />Pay Now
                      </Button>
                    )}
                  </div>
                </div>

                {expanded.has(inv.id) && (
                  <CardContent className="pt-0 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fee Items</p>
                        <div className="space-y-1">
                          {inv.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                              <span className="text-muted-foreground">{item.description}</span>
                              <span className="font-medium">{formatCurrency(Number(item.amount))}</span>
                            </div>
                          ))}
                          {Number(inv.discount ?? 0) > 0 && (
                            <div className="flex justify-between text-sm py-1 text-green-600">
                              <span>Discount</span><span>− {formatCurrency(Number(inv.discount))}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm pt-2 font-semibold">
                            <span>Total Paid</span>
                            <span className="text-green-600">{formatCurrency(Number(inv.paidAmount))}</span>
                          </div>
                          {due > 0 && (
                            <div className="flex justify-between text-sm font-semibold text-red-600">
                              <span>Balance Due</span><span>{formatCurrency(due)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment History</p>
                        {inv.payments.length > 0 ? (
                          <div className="space-y-2">
                            {inv.payments.map((p, i) => (
                              <div key={i} className="p-3 rounded-md bg-muted/50 text-sm">
                                <div className="flex justify-between font-medium">
                                  <span>{formatDate(p.paymentDate)}</span>
                                  <span className="text-green-600">{formatCurrency(Number(p.amount))}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{p.paymentMethod} · Receipt: {p.receiptNumber}</p>
                                {p.transactionRef && <p className="text-xs text-muted-foreground">Ref: {p.transactionRef}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded yet</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment method selection modal */}
      {selectInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-semibold">Choose Payment Method</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectInvoice.invoiceNumber}</p>
              </div>
              <button onClick={() => setSelectInvoice(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Amount */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Total</span>
                  <span className="font-medium">{formatCurrency(Number(selectInvoice.totalAmount))}</span>
                </div>
                {Number(selectInvoice.paidAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="text-green-600 font-medium">{formatCurrency(Number(selectInvoice.paidAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5 font-semibold text-red-600">
                  <span>Balance Due</span>
                  <span>{formatCurrency(Math.max(0, Number(selectInvoice.totalAmount) - Number(selectInvoice.discount ?? 0) - Number(selectInvoice.paidAmount)))}</span>
                </div>
              </div>

              {/* Amount input for partial payment */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount to Pay (₹)</label>
                <Input
                  type="number" step="0.01" min="1"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Payment method tiles */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Select Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const active = selectedMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedMethod(opt.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                          active
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className={`text-sm font-medium leading-tight ${active ? 'text-primary' : ''}`}>{opt.label}</p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{opt.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {modalError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {modalError}
                </div>
              )}

              {/* Proceed button */}
              <Button className="w-full" loading={launching} onClick={handleProceedToPay}>
                Proceed to Pay {customAmount ? formatCurrency(parseFloat(customAmount) || 0) : ''}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Secured by <span className="font-semibold text-[#3395FF]">Razorpay</span> · 100% safe & encrypted
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
