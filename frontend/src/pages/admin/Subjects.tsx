import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';

interface Subject { id: string; code: string; name: string; description?: string }
const EMPTY = { name: '', code: '', description: '' };

export default function SubjectsPage() {
  const [data, setData] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/subjects').then(r => setData(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); }
  function openEdit(s: Subject) { setEditing(s); setForm({ name: s.name, code: s.code, description: s.description || '' }); setError(''); setDialogOpen(true); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/subjects/${editing.id}`, form);
      else await api.post('/subjects', form);
      setDialogOpen(false); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/subjects/${deleteId}`); setDeleteId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns: Column<Subject>[] = [
    { key: 'code', header: 'Code', className: 'w-32' },
    { key: 'name', header: 'Subject Name' },
    { key: 'description', header: 'Description', render: r => r.description || '—' },
    { key: 'actions', header: '', className: 'w-24', render: r => (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => openEdit(r as unknown as Subject)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id as string)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Subjects"
        description={`${data.length} subjects configured`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Subjects' }]}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Subject</Button>}
      />
      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No subjects yet" />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Subject' : 'Add Subject'}</h2>
              <button onClick={() => setDialogOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Subject Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div><Label>Subject Code *</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. MATH101" required /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Add Subject'}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Delete Subject</h2>
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
