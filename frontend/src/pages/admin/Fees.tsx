import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Invoice {
  id: string; invoiceNumber: string;
  student: { firstName: string; lastName: string; admissionNumber: string };
  totalAmount: string; paidAmount: string; status: string; dueDate?: string; createdAt: string;
}

const STATUS_COLOR: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
  PAID: 'success', OVERDUE: 'destructive', PENDING: 'warning', PARTIAL: 'warning', WAIVED: 'default',
};

const STATUSES = ['', 'PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'WAIVED'];

export default function FeesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/fees/invoices', {
      params: {
        page, limit: 20,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      },
    })
      .then(r => { setInvoices(r.data.data ?? []); setTotal(r.data.total ?? 0); setTotalPages(r.data.totalPages ?? 1); })
      .catch(console.error).finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {}, 0);
  }

  function handleStatusChange(val: string) {
    setStatusFilter(val);
    setPage(1);
  }

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', className: 'w-36' },
    { key: 'student', header: 'Student', render: r => r.student ? `${r.student.firstName} ${r.student.lastName}` : '—' },
    { key: 'admNo', header: 'Adm. No.', render: r => r.student?.admissionNumber || '—' },
    { key: 'total', header: 'Total', render: r => formatCurrency(Number(r.totalAmount)) },
    { key: 'paid', header: 'Paid', render: r => formatCurrency(Number(r.paidAmount)) },
    { key: 'balance', header: 'Balance', render: r => {
      const bal = Number(r.totalAmount) - Number(r.paidAmount);
      return <span className={bal > 0 ? 'text-destructive font-medium' : 'text-green-600'}>{formatCurrency(bal)}</span>;
    }},
    { key: 'dueDate', header: 'Due Date', render: r => r.dueDate ? formatDate(r.dueDate) : '—' },
    { key: 'status', header: 'Status', render: r => <Badge variant={STATUS_COLOR[r.status] ?? 'default'}>{r.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Fee Management"
        description={`${total} invoices`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Fees' }]}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search student name or adm. no."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-64"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={e => handleStatusChange(e.target.value)}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={invoices as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No invoices found" page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}
