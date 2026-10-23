import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { Clock, Plus, Trash2, Zap, ChevronLeft, X } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

interface Timetable {
  id: string; name: string; isActive: boolean;
  class: { id: string; name: string };
  academicYear: { id: string; name: string };
  slots: Slot[];
}
interface Slot {
  id: string; dayOfWeek: string; startTime: string; endTime: string; room?: string;
  subject: { id: string; name: string };
  faculty: { id: string; firstName: string; lastName: string };
  section: { id: string; name: string };
}
interface Class { id: string; name: string; sections?: Section[] }
interface Section { id: string; name: string }
interface AcademicYear { id: string; name: string; isCurrent: boolean }
interface Subject { id: string; name: string }
interface Faculty { id: string; firstName: string; lastName: string }

const emptySlotForm = { sectionId: '', subjectId: '', facultyId: '', dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '09:00', room: '' };

export default function TimetablePage() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selected, setSelected] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reference data
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);

  // Create timetable modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ classId: '', academicYearId: '', name: '' });

  // Add slot modal
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotForm, setSlotForm] = useState({ ...emptySlotForm });
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/timetables'),
      api.get('/classes'),
      api.get('/academic-years'),
      api.get('/subjects'),
      api.get('/faculty'),
    ]).then(([tt, cl, ay, sub, fac]) => {
      setTimetables(tt.data.data ?? []);
      setClasses(cl.data.data ?? []);
      setAcademicYears(ay.data.data ?? []);
      setSubjects(sub.data.data ?? []);
      setFaculty(fac.data.data ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function loadTimetable(id: string) {
    const r = await api.get(`/timetables/${id}`);
    return r.data.data as Timetable;
  }

  async function openDetail(t: Timetable) {
    setLoading(true);
    try {
      const full = await loadTimetable(t.id);
      setSelected(full);
    } catch { setSelected(t); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!createForm.classId || !createForm.academicYearId || !createForm.name) return;
    setSaving(true); setError('');
    try {
      const r = await api.post('/timetables', createForm);
      const newTT: Timetable = { ...r.data.data, slots: [] };
      setTimetables(prev => [newTT, ...prev]);
      setShowCreate(false);
      setCreateForm({ classId: '', academicYearId: '', name: '' });
      setSelected(newTT);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create timetable');
    } finally { setSaving(false); }
  }

  async function handleActivate() {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      await api.post(`/timetables/${selected.id}/activate`);
      const updated = { ...selected, isActive: true };
      setSelected(updated);
      setTimetables(prev => prev.map(t => t.id === selected.id ? { ...t, isActive: true } : t.class.id === selected.class.id ? { ...t, isActive: false } : t));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to activate');
    } finally { setSaving(false); }
  }

  async function handleAddSlot() {
    if (!selected || !slotForm.sectionId || !slotForm.subjectId || !slotForm.facultyId) return;
    setSaving(true); setError('');
    try {
      const r = await api.post(`/timetables/${selected.id}/slots`, {
        ...slotForm,
        room: slotForm.room || undefined,
      });
      const full = await loadTimetable(selected.id);
      setSelected(full);
      setTimetables(prev => prev.map(t => t.id === full.id ? { ...t, slots: full.slots } : t));
      setShowAddSlot(false);
      setSlotForm({ ...emptySlotForm });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to add slot');
    } finally { setSaving(false); }
  }

  async function handleDeleteSlot(slotId: string) {
    if (!selected || !confirm('Delete this slot?')) return;
    try {
      await api.delete(`/timetables/${selected.id}/slots/${slotId}`);
      setSelected(prev => prev ? { ...prev, slots: prev.slots.filter(s => s.id !== slotId) } : prev);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to delete slot');
    }
  }

  async function onClassChange(classId: string) {
    setCreateForm(f => ({ ...f, classId }));
  }

  async function onSlotClassChange(classId: string) {
    try {
      const r = await api.get(`/classes/${classId}`);
      setSections(r.data.data?.sections ?? []);
    } catch { setSections([]); }
    setSlotForm(f => ({ ...f, sectionId: '' }));
  }

  if (loading && !selected) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const slotsByDay: Record<string, Slot[]> = {};
    DAYS.forEach(d => { slotsByDay[d] = selected.slots.filter(s => s.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime)); });

    return (
      <div>
        <PageHeader
          title={selected.name}
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Timetable', href: '/timetable' }, { label: selected.name }]}
        />

        {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded text-sm">{error}</div>}

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => { setSelected(null); setError(''); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-muted">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {selected.class?.name} · {selected.academicYear?.name}
          </span>
          <Badge variant={selected.isActive ? 'success' : 'secondary'} className="ml-auto">
            {selected.isActive ? 'Active' : 'Draft'}
          </Badge>
          {!selected.isActive && (
            <button onClick={handleActivate} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
              <Zap className="h-4 w-4" /> Activate
            </button>
          )}
          <button onClick={() => { setError(''); setShowAddSlot(true); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Slot
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map(day => (
            <Card key={day}>
              <CardHeader className="py-3 border-b">
                <CardTitle className="text-sm">{day.charAt(0) + day.slice(1).toLowerCase()}</CardTitle>
              </CardHeader>
              <CardContent className="pt-2 pb-3">
                {slotsByDay[day].length === 0
                  ? <p className="text-xs text-muted-foreground text-center py-4">No classes</p>
                  : slotsByDay[day].map(s => (
                    <div key={s.id} className="flex items-start justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{s.subject?.name}</p>
                        <p className="text-xs text-muted-foreground">Sec {s.section?.name} · {s.faculty?.firstName} {s.faculty?.lastName}</p>
                        <p className="text-xs text-primary">{s.startTime} – {s.endTime}{s.room ? ` · Room ${s.room}` : ''}</p>
                      </div>
                      <button onClick={() => handleDeleteSlot(s.id)} className="text-destructive hover:text-destructive/80 p-1 ml-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Slot Modal */}
        {showAddSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold">Add Timetable Slot</h2>
                <button onClick={() => setShowAddSlot(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-3">
                {error && <p className="text-sm text-destructive">{error}</p>}

                <div>
                  <label className="text-sm font-medium">Class (for section list)</label>
                  <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    onChange={e => onSlotClassChange(e.target.value)}>
                    <option value="">Select class…</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Section *</label>
                  <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={slotForm.sectionId} onChange={e => setSlotForm(f => ({ ...f, sectionId: e.target.value }))}>
                    <option value="">Select section…</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Subject *</label>
                  <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={slotForm.subjectId} onChange={e => setSlotForm(f => ({ ...f, subjectId: e.target.value }))}>
                    <option value="">Select subject…</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Faculty *</label>
                  <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={slotForm.facultyId} onChange={e => setSlotForm(f => ({ ...f, facultyId: e.target.value }))}>
                    <option value="">Select faculty…</option>
                    {faculty.map(f => <option key={f.id} value={f.id}>{f.firstName} {f.lastName}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Day *</label>
                  <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={slotForm.dayOfWeek} onChange={e => setSlotForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                    {DAYS.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Start Time *</label>
                    <input type="time" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={slotForm.startTime} onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Time *</label>
                    <input type="time" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={slotForm.endTime} onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Room (optional)</label>
                  <input type="text" placeholder="e.g. Room 101" className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={slotForm.room} onChange={e => setSlotForm(f => ({ ...f, room: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => setShowAddSlot(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-muted">Cancel</button>
                <button onClick={handleAddSlot} disabled={saving || !slotForm.sectionId || !slotForm.subjectId || !slotForm.facultyId}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add Slot'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Timetable Management"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Timetable' }]}
        actions={
          <button onClick={() => { setError(''); setShowCreate(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium">
            <Plus className="h-4 w-4" /> New Timetable
          </button>
        }
      />

      {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded text-sm">{error}</div>}

      {timetables.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No timetables configured yet</p>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
            <Plus className="h-4 w-4" /> Create First Timetable
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {timetables.map(t => (
            <Card key={t.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openDetail(t)}>
              <CardHeader><CardTitle className="text-base">{t.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.class?.name} · {t.academicYear?.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{t.slots.length} slots</span>
                  <Badge variant={t.isActive ? 'success' : 'secondary'}>{t.isActive ? 'Active' : 'Draft'}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Timetable Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">New Timetable</h2>
              <button onClick={() => setShowCreate(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}

              <div>
                <label className="text-sm font-medium">Name *</label>
                <input type="text" placeholder="e.g. Year 7 Timetable 2024-25"
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label className="text-sm font-medium">Class *</label>
                <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={createForm.classId} onChange={e => onClassChange(e.target.value)}>
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Academic Year *</label>
                <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={createForm.academicYearId} onChange={e => setCreateForm(f => ({ ...f, academicYearId: e.target.value }))}>
                  <option value="">Select year…</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-muted">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !createForm.name || !createForm.classId || !createForm.academicYearId}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
