import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, Star, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface AcYear { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }
const EMPTY = { name: '', startDate: '', endDate: '' };

export default function AcademicYearsPage() {
  const [data, setData] = useState<AcYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcYear | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/academic-years').then(r => setData(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); }
  function openEdit(y: AcYear) {
    setEditing(y);
    setForm({ name: y.name, startDate: y.startDate.split('T')[0], endDate: y.endDate.split('T')[0] });
    setError(''); setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/academic-years/${editing.id}`, form);
      else await api.post('/academic-years', form);
      setDialogOpen(false); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  }

  async function setCurrent(id: string) {
    try { await api.post(`/academic-years/${id}/set-current`); load(); }
    catch (err) { console.error(err); }
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/academic-years/${deleteId}`); setDeleteId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns: Column<AcYear>[] = [
    { key: 'name', header: 'Academic Year' },
    { key: 'startDate', header: 'Start Date', render: r => formatDate(r.startDate) },
    { key: 'endDate', header: 'End Date', render: r => formatDate(r.endDate) },
    { key: 'isCurrent', header: 'Status', render: r => r.isCurrent ? <Badge variant="success">Current</Badge> : <Badge variant="secondary">Inactive</Badge> },
    { key: 'actions', header: '', className: 'w-40', render: r => (
      <div className="flex gap-1 justify-end items-center">
        {!(r as unknown as AcYear).isCurrent && (
          <Button size="sm" variant="outline" onClick={() => setCurrent(r.id as string)}><Star className="h-3 w-3 mr-1" />Set Current</Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => openEdit(r as unknown as AcYear)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id as string)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Academic Years"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Academic Years' }]}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Year</Button>}
      />
      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No academic years" />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Academic Year' : 'Add Academic Year'}</h2>
              <button onClick={() => setDialogOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 2025-2026" required /></div>
              <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
              <div><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Add Year'}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Delete Academic Year</h2>
            <p className="text-sm text-muted-foreground mb-4">Are you sure? All classes and data linked to this year will be affected.</p>
            <div className="flex gap-2">
              <Button variant="destructive" loading={deleting} onClick={handleDelete} className="flex-1">Delete</Button>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
