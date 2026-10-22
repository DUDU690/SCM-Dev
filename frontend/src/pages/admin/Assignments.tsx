import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Assignment { id: string; title: string; dueDate: string; isPublished: boolean; description: string; maxMarks?: number; subject: { id: string; name: string }; faculty: { id: string; firstName: string; lastName: string } | null; submissions: { id: string }[] }
const EMPTY = { title: '', subjectId: '', facultyId: '', description: '', dueDate: '', maxMarks: '' };

export default function AssignmentsPage() {
  const { user } = useAppSelector((s) => s.auth);
  const isAdmin = user?.role === 'ADMIN';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [faculty, setFaculty] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const calls: Promise<unknown>[] = [api.get('/assignments'), api.get('/subjects')];
    if (isAdmin) calls.push(api.get('/faculty', { params: { limit: 200 } }));
    Promise.allSettled(calls).then(([aRes, sRes, fRes]) => {
      if (aRes.status === 'fulfilled') setAssignments((aRes.value as { data: { data?: Assignment[] } }).data.data ?? []);
      if (sRes.status === 'fulfilled') setSubjects((sRes.value as { data: { data?: { id: string; name: string }[] } }).data.data ?? []);
      if (fRes?.status === 'fulfilled') setFaculty((fRes.value as { data: { data?: { id: string; firstName: string; lastName: string }[] } }).data.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); }
  function openEdit(a: Assignment) {
    setEditing(a);
    setForm({ title: a.title, subjectId: a.subject.id, facultyId: a.faculty?.id || '', description: a.description, dueDate: a.dueDate.slice(0, 16), maxMarks: a.maxMarks?.toString() || '' });
    setError(''); setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    const payload = { ...form, maxMarks: form.maxMarks ? parseInt(form.maxMarks) : undefined };
    try {
      if (editing) await api.patch(`/assignments/${editing.id}`, payload);
      else await api.post('/assignments', payload);
      setDialogOpen(false); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  }

  async function togglePublish(a: Assignment) {
    try {
      await api.patch(`/assignments/${a.id}`, { isPublished: !a.isPublished });
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to update');
    }
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/assignments/${deleteId}`); setDeleteId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns: Column<Assignment>[] = [
    { key: 'title', header: 'Title' },
    { key: 'subject', header: 'Subject', render: r => (r.subject as { name: string }).name },
    { key: 'faculty', header: 'Faculty', render: r => { const f = r.faculty as { firstName: string; lastName: string } | null; return f ? `${f.firstName} ${f.lastName}` : '—'; } },
    { key: 'dueDate', header: 'Due Date', render: r => formatDate(r.dueDate as string) },
    { key: 'submissions', header: 'Submissions', render: r => ((r.submissions as { id: string }[] | undefined) ?? []).length },
    { key: 'status', header: 'Status', render: r => <Badge variant={(r.isPublished as boolean) ? 'success' : 'secondary'}>{(r.isPublished as boolean) ? 'Published' : 'Draft'}</Badge> },
    { key: 'actions', header: '', className: 'w-28', render: r => {
      const a = r as unknown as Assignment;
      return (
        <div className="flex gap-1 justify-end">
          <Button
            size="sm" variant="ghost"
            title={a.isPublished ? 'Unpublish' : 'Publish'}
            className={a.isPublished ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-foreground'}
            onClick={() => togglePublish(a)}
          >
            {a.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
          {isAdmin && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      );
    }},
  ];

  return (
    <div>
      <PageHeader
        title="Assignments"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Assignments' }]}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Create Assignment</Button>}
      />
      <DataTable columns={columns} data={assignments as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No assignments" />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Assignment' : 'Create Assignment'}</h2>
              <button onClick={() => setDialogOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div><Label>Subject *</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))} required><option value="">Select</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              {isAdmin && <div><Label>Faculty *</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.facultyId} onChange={e => setForm(f => ({ ...f, facultyId: e.target.value }))} required={isAdmin}><option value="">Select</option>{faculty.map(f => <option key={f.id} value={f.id}>{f.firstName} {f.lastName}</option>)}</select></div>}
              <div><Label>Description *</Label><textarea className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Due Date *</Label><Input type="datetime-local" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required /></div>
                <div><Label>Max Marks</Label><Input type="number" min={0} value={form.maxMarks} onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Create'}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Delete Assignment</h2>
            <p className="text-sm text-muted-foreground mb-4">Are you sure? All submissions will also be deleted.</p>
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
