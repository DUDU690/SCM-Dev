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

interface OnlineClass { id: string; title: string; scheduledAt: string; duration: number; isPublished: boolean; description?: string; meetingLink: string; subject: { id: string; name: string }; faculty: { id: string; firstName: string; lastName: string } | null }
interface Subject { id: string; name: string }
interface Faculty { id: string; firstName: string; lastName: string }
const EMPTY = { title: '', subjectId: '', facultyId: '', meetingLink: '', scheduledAt: '', duration: '60', description: '' };

export default function OnlineClassesPage() {
  const { user } = useAppSelector((s) => s.auth);
  const isAdmin = user?.role === 'ADMIN';
  const [classes, setClasses] = useState<OnlineClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OnlineClass | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const calls: Promise<unknown>[] = [api.get('/online-classes'), api.get('/subjects')];
    if (isAdmin) calls.push(api.get('/faculty', { params: { limit: 200 } }));
    Promise.allSettled(calls).then(([classRes, subjectRes, facultyRes]) => {
      if (classRes.status === 'fulfilled') setClasses((classRes.value as { data: { data?: OnlineClass[] } }).data.data ?? []);
      if (subjectRes.status === 'fulfilled') setSubjects((subjectRes.value as { data: { data?: Subject[] } }).data.data ?? []);
      if (facultyRes?.status === 'fulfilled') setFaculty((facultyRes.value as { data: { data?: Faculty[] } }).data.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); }
  function openEdit(oc: OnlineClass) {
    setEditing(oc);
    setForm({ title: oc.title, subjectId: oc.subject.id, facultyId: oc.faculty?.id || '', meetingLink: oc.meetingLink, scheduledAt: oc.scheduledAt.slice(0, 16), duration: oc.duration.toString(), description: oc.description || '' });
    setError(''); setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    const payload = { ...form, duration: parseInt(form.duration) };
    try {
      if (editing) await api.patch(`/online-classes/${editing.id}`, payload);
      else await api.post('/online-classes', payload);
      setDialogOpen(false); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  }

  async function togglePublish(oc: OnlineClass) {
    try {
      await api.patch(`/online-classes/${oc.id}`, { isPublished: !oc.isPublished });
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to update');
    }
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/online-classes/${deleteId}`); setDeleteId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns: Column<OnlineClass>[] = [
    { key: 'title', header: 'Title' },
    { key: 'subject', header: 'Subject', render: r => (r.subject as { name: string }).name },
    { key: 'faculty', header: 'Faculty', render: r => { const f = r.faculty as { firstName: string; lastName: string } | null; return f ? `${f.firstName} ${f.lastName}` : '—'; } },
    { key: 'scheduledAt', header: 'Scheduled', render: r => formatDate(r.scheduledAt as string) },
    { key: 'duration', header: 'Duration', render: r => `${r.duration as number} min` },
    { key: 'status', header: 'Status', render: r => <Badge variant={(r.isPublished as boolean) ? 'success' : 'secondary'}>{(r.isPublished as boolean) ? 'Published' : 'Draft'}</Badge> },
    { key: 'actions', header: '', className: 'w-28', render: r => {
      const oc = r as unknown as OnlineClass;
      return (
        <div className="flex gap-1 justify-end">
          <Button
            size="sm" variant="ghost"
            title={oc.isPublished ? 'Unpublish' : 'Publish'}
            className={oc.isPublished ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-foreground'}
            onClick={() => togglePublish(oc)}
          >
            {oc.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(oc)}><Pencil className="h-3.5 w-3.5" /></Button>
          {isAdmin && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(oc.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      );
    }},
  ];

  return (
    <div>
      <PageHeader
        title="Online Classes"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Online Classes' }]}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Schedule Class</Button>}
      />
      <DataTable columns={columns} data={classes as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No online classes" />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Online Class' : 'Schedule Online Class'}</h2>
              <button onClick={() => setDialogOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div><Label>Subject *</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))} required><option value="">Select</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              {isAdmin && <div><Label>Faculty *</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.facultyId} onChange={e => setForm(f => ({ ...f, facultyId: e.target.value }))} required={isAdmin}><option value="">Select</option>{faculty.map(f => <option key={f.id} value={f.id}>{f.firstName} {f.lastName}</option>)}</select></div>}
              <div><Label>Meeting Link *</Label><Input type="url" value={form.meetingLink} onChange={e => setForm(f => ({ ...f, meetingLink: e.target.value }))} placeholder="https://meet.google.com/..." required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Scheduled At *</Label><Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} required /></div>
                <div><Label>Duration (min)</Label><Input type="number" min={15} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Schedule'}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Delete Online Class</h2>
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
