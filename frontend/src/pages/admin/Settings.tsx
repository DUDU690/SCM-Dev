import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface SchoolSettings {
  id?: string; name: string; address?: string; phone?: string; email?: string;
  website?: string; tagline?: string; principalName?: string; establishedYear?: number; logo?: string;
}

interface PaymentSettings {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayMode: 'test' | 'live';
  configured: boolean;
  upiId: string;
  upiName: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Payment settings
  const [payment, setPayment] = useState<PaymentSettings>({ razorpayKeyId: '', razorpayKeySecret: '', razorpayMode: 'test', configured: false, upiId: '', upiName: '' });
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(r => setSettings(r.data.data ?? { name: '' }))
      .catch(() => setSettings({ name: '' }))
      .finally(() => setLoading(false));

    api.get('/settings/payment')
      .then(r => setPayment(p => ({ ...p, ...r.data.data, razorpayKeySecret: '' })))
      .catch(console.error)
      .finally(() => setPaymentLoading(false));
  }, []);

  async function handleSaveSchool(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.patch('/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    setPaymentSaving(true); setPaymentError(''); setPaymentSaved(false);
    try {
      const payload: Record<string, string> = { razorpayMode: payment.razorpayMode };
      if (payment.razorpayKeyId) payload.razorpayKeyId = payment.razorpayKeyId;
      if (payment.razorpayKeySecret) payload.razorpayKeySecret = payment.razorpayKeySecret;
      payload.upiId = payment.upiId;
      payload.upiName = payment.upiName;
      await api.patch('/settings/payment', payload);
      // Re-fetch to get updated configured status
      const r = await api.get('/settings/payment');
      setPayment(p => ({ ...p, ...r.data.data, razorpayKeySecret: '', upiId: r.data.data.upiId || '', upiName: r.data.data.upiName || '' }));
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 3000);
    } catch (err: unknown) {
      setPaymentError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to save');
    } finally { setPaymentSaving(false); }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div>
      <PageHeader title="Settings" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />
      <div className="max-w-2xl space-y-6">

        {/* School Information */}
        <Card>
          <CardHeader><CardTitle>School Information</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">{error}</p>}
            {saved && (
              <div className="flex items-center gap-2 text-sm text-green-600 mb-4 p-2 bg-green-50 dark:bg-green-950 rounded">
                <CheckCircle className="h-4 w-4" />School settings saved!
              </div>
            )}
            <form onSubmit={handleSaveSchool} className="space-y-4">
              <div>
                <Label>School Name *</Label>
                <Input value={settings?.name ?? ''} onChange={e => setSettings(s => s ? { ...s, name: e.target.value } : s)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input value={settings?.phone ?? ''} onChange={e => setSettings(s => s ? { ...s, phone: e.target.value } : s)} /></div>
                <div><Label>Email</Label><Input type="email" value={settings?.email ?? ''} onChange={e => setSettings(s => s ? { ...s, email: e.target.value } : s)} /></div>
              </div>
              <div><Label>Address</Label><Input value={settings?.address ?? ''} onChange={e => setSettings(s => s ? { ...s, address: e.target.value } : s)} /></div>
              <div><Label>Website</Label><Input type="url" value={settings?.website ?? ''} onChange={e => setSettings(s => s ? { ...s, website: e.target.value } : s)} /></div>
              <div><Label>Tagline</Label><Input value={settings?.tagline ?? ''} onChange={e => setSettings(s => s ? { ...s, tagline: e.target.value } : s)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Principal Name</Label><Input value={settings?.principalName ?? ''} onChange={e => setSettings(s => s ? { ...s, principalName: e.target.value } : s)} /></div>
                <div><Label>Established Year</Label><Input type="number" min={1800} max={new Date().getFullYear()} value={settings?.establishedYear ?? ''} onChange={e => setSettings(s => s ? { ...s, establishedYear: parseInt(e.target.value) || undefined } : s)} /></div>
              </div>
              <Button type="submit" loading={saving}>Save Settings</Button>
            </form>
          </CardContent>
        </Card>

        {/* Payment Gateway */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payment Gateway — Razorpay</CardTitle>
              {!paymentLoading && (
                payment.configured
                  ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle className="h-3.5 w-3.5" />Configured</span>
                  : <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertCircle className="h-3.5 w-3.5" />Not configured</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {paymentLoading ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">How to get your Razorpay keys:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs">
                    <li>Sign up / log in at <a href="https://razorpay.com" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">razorpay.com <ExternalLink className="h-3 w-3" /></a></li>
                    <li>Go to <strong>Settings → API Keys</strong></li>
                    <li>Generate keys for Test mode first, switch to Live when ready</li>
                    <li>Copy Key ID and Key Secret below</li>
                  </ol>
                </div>

                {paymentError && (
                  <div className="flex items-center gap-2 text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
                    <AlertCircle className="h-4 w-4" />{paymentError}
                  </div>
                )}
                {paymentSaved && (
                  <div className="flex items-center gap-2 text-sm text-green-600 mb-4 p-2 bg-green-50 dark:bg-green-950 rounded">
                    <CheckCircle className="h-4 w-4" />Payment settings saved! UPI and all payment methods are now active.
                  </div>
                )}

                <form onSubmit={handleSavePayment} className="space-y-4">
                  {/* Mode toggle */}
                  <div>
                    <Label>Mode</Label>
                    <div className="flex gap-2 mt-1">
                      {(['test', 'live'] as const).map(m => (
                        <button
                          key={m} type="button"
                          onClick={() => setPayment(p => ({ ...p, razorpayMode: m }))}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${
                            payment.razorpayMode === m
                              ? m === 'live' ? 'bg-green-600 text-white border-green-600' : 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          {m === 'test' ? '🧪 Test Mode' : '🚀 Live Mode'}
                        </button>
                      ))}
                    </div>
                    {payment.razorpayMode === 'live' && (
                      <p className="text-xs text-amber-600 mt-1.5 font-medium">⚠️ Live mode processes real payments. Make sure your account is fully activated on Razorpay.</p>
                    )}
                  </div>

                  {/* Key ID */}
                  <div>
                    <Label>
                      {payment.razorpayMode === 'live' ? 'Live' : 'Test'} Key ID
                    </Label>
                    <Input
                      value={payment.razorpayKeyId}
                      onChange={e => setPayment(p => ({ ...p, razorpayKeyId: e.target.value }))}
                      placeholder={payment.razorpayMode === 'live' ? 'rzp_live_...' : 'rzp_test_...'}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Key Secret */}
                  <div>
                    <Label>
                      {payment.razorpayMode === 'live' ? 'Live' : 'Test'} Key Secret
                      <span className="text-xs text-muted-foreground font-normal ml-1">(leave blank to keep existing)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showSecret ? 'text' : 'password'}
                        value={payment.razorpayKeySecret}
                        onChange={e => setPayment(p => ({ ...p, razorpayKeySecret: e.target.value }))}
                        placeholder="Enter new secret to update"
                        className="font-mono text-sm pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowSecret(s => !s)}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Direct UPI (without Razorpay)</p>
                    <p className="text-xs text-muted-foreground mb-3">Students will see a scannable QR code when UPI is selected. They pay directly to your UPI ID and enter the transaction reference to confirm.</p>
                    <div className="space-y-3">
                      <div>
                        <Label>UPI ID</Label>
                        <Input
                          value={payment.upiId}
                          onChange={e => setPayment(p => ({ ...p, upiId: e.target.value }))}
                          placeholder="school@upi or school@sbi"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label>Display Name (shown on QR)</Label>
                        <Input
                          value={payment.upiName}
                          onChange={e => setPayment(p => ({ ...p, upiName: e.target.value }))}
                          placeholder="e.g. SAKA School"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button type="submit" loading={paymentSaving}>Save Payment Settings</Button>
                  </div>

                  <div className="text-xs text-muted-foreground border-t pt-3">
                    <p className="font-medium mb-1">Supported payment methods once configured:</p>
                    <div className="flex flex-wrap gap-2">
                      {['UPI QR Code (direct)', 'UPI via Razorpay', 'Debit / Credit Card', 'Net Banking', 'Wallets'].map(m => (
                        <span key={m} className="px-2 py-0.5 bg-muted rounded-full">{m}</span>
                      ))}
                    </div>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
