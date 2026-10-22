import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, UserX, UserCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface User { id: string; email: string; role: string; isActive: boolean; lastLoginAt?: string; createdAt: string }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'STUDENT', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users', { params: { page, limit: 20, role: roleFilter || undefined } })
      .then(r => { setUsers(r.data.data); setTotal(r.data.total); setTotalPages(r.data.totalPages); })
      .catch(console.error).finally(() => setLoading(false));
  }, [page, roleFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try { await api.post('/users', form); setDialogOpen(false); setForm({ email: '', role: 'STUDENT', password: '' }); load(); }
    catch (err: unknown) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this user account?')) return;
    try { await api.patch(`/users/${id}`, { isActive: false }); load(); }
    catch (err) { console.error(err); }
  }

  async function activate(id: string) {
    if (!confirm('Activate this user account?')) return;
    try { await api.patch(`/users/${id}`, { isActive: true }); load(); }
    catch (err) { console.error(err); }
  }

  const ROLE_COLOR: Record<string, 'default' | 'info' | 'success'> = { ADMIN: 'default', FACULTY: 'info', STUDENT: 'success' };

  const columns: Column<User>[] = [
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: r => <Badge variant={ROLE_COLOR[r.role] ?? 'default'}>{r.role}</Badge> },
    { key: 'isActive', header: 'Status', render: r => r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="destructive">Inactive</Badge> },
    { key: 'lastLoginAt', header: 'Last Login', render: r => r.lastLoginAt ? formatDate(r.lastLoginAt, 'dd MMM yyyy HH:mm') : 'Never' },
    { key: 'createdAt', header: 'Created', render: r => formatDate(r.createdAt) },
    { key: 'actions', header: '', render: r => r.isActive ? (
      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deactivate(r.id)} title="Deactivate">
        <UserX className="h-4 w-4" />
      </Button>
    ) : (
      <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => activate(r.id)}>
        <UserCheck className="h-4 w-4 mr-1" />Activate
      </Button>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="User Accounts"
        description={`${total} users`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]}
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add User</Button>}
      />

      <div className="mb-4">
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="FACULTY">Faculty</option>
          <option value="STUDENT">Student</option>
        </select>
      </div>

      <DataTable columns={columns} data={users as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No users" page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add User</h2>
              <button onClick={() => { setDialogOpen(false); setError(''); }}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleAdd} className="space-y-3">
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div>
                <Label>Role *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="ADMIN">Admin</option><option value="FACULTY">Faculty</option><option value="STUDENT">Student</option>
                </select>
              </div>
              <div><Label>Initial Password *</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="Min 8 chars, 1 upper, 1 number" /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">Create User</Button>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
