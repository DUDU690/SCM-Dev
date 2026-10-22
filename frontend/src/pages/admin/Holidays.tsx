import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Holiday { id: string; name: string; date: string; description?: string; academicYear: { name: string } }
interface AcYear { id: string; name: string }
const EMPTY = { name: '', date: '', description: '', academicYearId: '' };

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [acYears, setAcYears] = useState<AcYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/holidays'), api.get('/academic-years')])
      .then(([h, y]) => { setHolidays(h.data.data ?? []); setAcYears(y.data.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); }
  function openEdit(h: Holiday) {
    setEditing(h);
    setForm({ name: h.name, date: h.date.split('T')[0], description: h.description || '', academicYearId: '' });
    setError(''); setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/holidays/${editing.id}`, { name: form.name, date: form.date, description: form.description });
      else await api.post('/holidays', form);
      setDialogOpen(false); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/holidays/${deleteId}`); setDeleteId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns: Column<Holiday>[] = [
    { key: 'name', header: 'Holiday' },
    { key: 'date', header: 'Date', render: r => formatDate(r.date as string) },
    { key: 'description', header: 'Description', render: r => (r.description as string) || '—' },
    { key: 'year', header: 'Academic Year', render: r => (r as unknown as Holiday).academicYear?.name ?? '—' },
    { key: 'actions', header: '', className: 'w-20', render: r => (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => openEdit(r as unknown as Holiday)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id as string)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Holidays"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Holidays' }]}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Holiday</Button>}
      />
      <DataTable columns={columns} data={holidays as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No holidays" />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Holiday' : 'Add Holiday'}</h2>
              <button onClick={() => setDialogOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
              {!editing && (
                <div>
                  <Label>Academic Year *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} required>
                    <option value="">Select</option>{acYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
              )}
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Add'}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Delete Holiday</h2>
            <p className="text-sm text-muted-foreground mb-4">Are you sure? This cannot be undone.</p>
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
