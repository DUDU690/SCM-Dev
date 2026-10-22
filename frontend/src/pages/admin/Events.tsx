import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Event { id: string; title: string; startDate: string; endDate?: string; venue?: string; description?: string; status: string }
const EMPTY = { title: '', startDate: '', endDate: '', venue: '', description: '' };
const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'secondary'> = { DRAFT: 'secondary', PENDING_APPROVAL: 'warning', PUBLISHED: 'success', ARCHIVED: 'default' };

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/events').then(r => setEvents(r.data.data ?? [])).catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); }
  function openEdit(ev: Event) {
    setEditing(ev);
    setForm({ title: ev.title, startDate: ev.startDate.split('T')[0], endDate: ev.endDate ? ev.endDate.split('T')[0] : '', venue: ev.venue || '', description: ev.description || '' });
    setError(''); setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/events/${editing.id}`, form);
      else await api.post('/events', form);
      setDialogOpen(false); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true);
    try { await api.delete(`/events/${deleteId}`); setDeleteId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  const columns: Column<Event>[] = [
    { key: 'title', header: 'Event' },
    { key: 'startDate', header: 'Start Date', render: r => formatDate(r.startDate as string) },
    { key: 'endDate', header: 'End Date', render: r => (r.endDate as string) ? formatDate(r.endDate as string) : '—' },
    { key: 'venue', header: 'Venue', render: r => (r.venue as string) || '—' },
    { key: 'status', header: 'Status', render: r => <Badge variant={STATUS_COLOR[r.status as string] ?? 'default'}>{r.status as string}</Badge> },
    { key: 'actions', header: '', className: 'w-20', render: r => (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => openEdit(r as unknown as Event)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id as string)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="School Events"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Events' }]}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Event</Button>}
      />
      <DataTable columns={columns} data={events as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No events" />

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Event' : 'Add Event'}</h2>
              <button onClick={() => setDialogOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required /></div>
                <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
              </div>
              <div><Label>Venue</Label><Input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} /></div>
              <div><Label>Description</Label><textarea className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Add Event'}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-2">Delete Event</h2>
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
