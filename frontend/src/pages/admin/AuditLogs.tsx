import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

interface AuditLog {
  id: string; action: string; resource: string; resourceId?: string;
  ipAddress?: string; createdAt: string;
  user: { email: string; role: string };
}

const ACTION_COLOR: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'info'> = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'destructive', LOGIN: 'default', LOGOUT: 'default', PUBLISH: 'warning',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [resourceFilter, setResourceFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/audit-logs', { params: { page, limit: 30, resource: resourceFilter || undefined } })
      .then(r => { setLogs(r.data.data); setTotal(r.data.total); setTotalPages(r.data.totalPages); })
      .catch(console.error).finally(() => setLoading(false));
  }, [page, resourceFilter]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<AuditLog>[] = [
    { key: 'createdAt', header: 'Time', render: r => formatDate(r.createdAt, 'dd MMM HH:mm:ss'), className: 'w-40' },
    { key: 'user', header: 'User', render: r => r.user?.email || '—' },
    { key: 'action', header: 'Action', render: r => <Badge variant={ACTION_COLOR[r.action] ?? 'default'}>{r.action}</Badge> },
    { key: 'resource', header: 'Resource' },
    { key: 'resourceId', header: 'ID', render: r => r.resourceId ? r.resourceId.slice(-8) : '—', className: 'w-24' },
    { key: 'ipAddress', header: 'IP', render: r => r.ipAddress || '—', className: 'w-32' },
  ];

  const RESOURCES = ['User', 'Student', 'Faculty', 'Attendance', 'Mark', 'Examination', 'FeePayment', 'Admission', 'Event', 'Achievement'];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description={`${total} audit records`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Logs' }]}
      />
      <div className="mb-4">
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={resourceFilter} onChange={e => { setResourceFilter(e.target.value); setPage(1); }}>
          <option value="">All Resources</option>
          {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <DataTable columns={columns} data={logs as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No audit logs" page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}
