import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, Send, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Exam { id: string; name: string; startDate: string; endDate: string; isPublished: boolean; class: { id: string; name: string }; academicYear: { id: string; name: string } }
interface AcYear { id: string; name: string }
interface ClassItem { id: string; name: string }
const EMPTY = { name: '', academicYearId: '', classId: '', startDate: '', endDate: '' };

export default function ExaminationsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [acYears, setAcYears] = useState<AcYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/examinations'), api.get('/academic-years'), api.get('/classes')])
      .then(([e, y, c]) => { setExams(e.data.data); setAcYears(y.data.data); setClasses(c.data.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); }
  function openEdit(ex: Exam) {
    setEditing(ex);
    setForm({ name: ex.name, academicYearId: ex.academicYear.id, classId: ex.class.id, startDate: ex.startDate.split('T')[0], endDate: ex.endDate.split('T')[0] });
    setError(''); setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/examinations/${editing.id}`, { name: form.name, startDate: form.startDate, endDate: form.endDate });
      else await api.post('/examinations', form);
      setDialogOpen(false); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  }

  async function publish(id: string) {
    if (!confirm('Publish results for this examination? Marks will become visible to students.')) return;
    try { await api.post(`/examinations/${id}/publish`); load(); }
    catch (err) { console.error(err); }
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/examinations/${deleteId}`); setDeleteId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns: Column<Exam>[] = [
    { key: 'name', header: 'Examination' },
    { key: 'class', header: 'Class', render: r => (r.class as { name: string })?.name ?? '—' },
    { key: 'academicYear', header: 'Year', render: r => (r.academicYear as { name: string })?.name ?? '—' },
    { key: 'startDate', header: 'Start', render: r => formatDate(r.startDate as string) },
    { key: 'endDate', header: 'End', render: r => formatDate(r.endDate as string) },
    { key: 'status', header: 'Status', render: r => (r.isPublished as boolean) ? <Badge variant="success">Published</Badge> : <Badge variant="warning">Draft</Badge> },
    { key: 'actions', header: '', className: 'w-36', render: r => (
      <div className="flex gap-1 justify-end items-center">
        {!(r.isPublished as boolean) && (
          <Button size="sm" variant="outline" onClick={() => publish(r.id as string)}><Send className="h-3 w-3 mr-1" />Publish</Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => openEdit(r as unknown as Exam)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id as string)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Examinations"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Examinations' }]}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Examination</Button>}
      />
      <DataTable columns={columns} data={exams as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No examinations" />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Examination' : 'Add Examination'}</h2>
              <button onClick={() => setDialogOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mid-term 2025" required /></div>
              {!editing && (
                <>
                  <div>
                    <Label>Academic Year *</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} required>
                      <option value="">Select</option>{acYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Class *</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))} required>
                      <option value="">Select</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {editing && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">Class: <strong>{editing.class.name}</strong> · Year: <strong>{editing.academicYear.name}</strong></p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
                <div><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required /></div>
              </div>
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
            <h2 className="text-lg font-semibold mb-2">Delete Examination</h2>
            <p className="text-sm text-muted-foreground mb-4">Are you sure? All marks and subject records will also be deleted.</p>
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
