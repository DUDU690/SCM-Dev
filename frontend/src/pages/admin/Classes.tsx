import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Plus, X, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';

interface AcYear { id: string; name: string }
interface Section { id: string; name: string; capacity: number }
interface ClassItem { id: string; name: string; academicYear: AcYear; sections: Section[] }

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [acYears, setAcYears] = useState<AcYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [classDialog, setClassDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classForm, setClassForm] = useState({ name: '', academicYearId: '' });

  const [sectionDialog, setSectionDialog] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<{ classId: string; section: Section } | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', capacity: '40' });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);
  const [deleteSectionInfo, setDeleteSectionInfo] = useState<{ classId: string; sectionId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/classes'), api.get('/academic-years')])
      .then(([c, y]) => { setClasses(c.data.data); setAcYears(y.data.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function toggle(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function openAddClass() { setEditingClass(null); setClassForm({ name: '', academicYearId: '' }); setError(''); setClassDialog(true); }
  function openEditClass(c: ClassItem) { setEditingClass(c); setClassForm({ name: c.name, academicYearId: c.academicYear.id }); setError(''); setClassDialog(true); }

  async function handleClassSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editingClass) await api.patch(`/classes/${editingClass.id}`, { name: classForm.name });
      else await api.post('/classes', classForm);
      setClassDialog(false); load();
    } catch (err: unknown) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteClass() {
    if (!deleteClassId) return; setDeleting(true);
    try { await api.delete(`/classes/${deleteClassId}`); setDeleteClassId(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  function openAddSection(classId: string) { setEditingSection(null); setSectionDialog(classId); setSectionForm({ name: '', capacity: '40' }); setError(''); }
  function openEditSection(classId: string, section: Section) { setEditingSection({ classId, section }); setSectionDialog(classId); setSectionForm({ name: section.name, capacity: section.capacity.toString() }); setError(''); }

  async function handleSectionSave(classId: string, e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    const payload = { name: sectionForm.name, capacity: sectionForm.capacity ? parseInt(sectionForm.capacity) : undefined };
    try {
      if (editingSection) await api.patch(`/classes/${classId}/sections/${editingSection.section.id}`, payload);
      else await api.post(`/classes/${classId}/sections`, payload);
      setSectionDialog(null); setEditingSection(null); load();
    } catch (err: unknown) { setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteSection() {
    if (!deleteSectionInfo) return; setDeleting(true);
    try { await api.delete(`/classes/${deleteSectionInfo.classId}/sections/${deleteSectionInfo.sectionId}`); setDeleteSectionInfo(null); load(); }
    catch (err: unknown) { alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div>
      <PageHeader
        title="Classes"
        description={`${classes.length} classes configured`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Classes' }]}
        actions={<Button onClick={openAddClass}><Plus className="h-4 w-4 mr-1" />Add Class</Button>}
      />

      <div className="space-y-3">
        {classes.length === 0 && <p className="text-center text-muted-foreground py-12">No classes yet. Add one to get started.</p>}
        {classes.map(c => (
          <Card key={c.id}>
            <CardHeader className="py-3 cursor-pointer" onClick={() => toggle(c.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expanded.has(c.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <span className="text-xs text-muted-foreground">· {c.academicYear?.name}</span>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-muted-foreground mr-2">{c.sections.length} sections</span>
                  <Button size="sm" variant="outline" onClick={() => openAddSection(c.id)}><Plus className="h-3 w-3 mr-1" />Section</Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditClass(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteClassId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardHeader>
            {expanded.has(c.id) && c.sections.length > 0 && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {c.sections.map(s => (
                    <div key={s.id} className="p-3 rounded-md bg-muted/50 text-sm relative group">
                      <p className="font-medium">Section {s.name}</p>
                      <p className="text-xs text-muted-foreground">Capacity: {s.capacity}</p>
                      <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                        <button className="p-1 rounded hover:bg-background" onClick={() => openEditSection(c.id, s)}><Pencil className="h-3 w-3" /></button>
                        <button className="p-1 rounded hover:bg-background text-destructive" onClick={() => setDeleteSectionInfo({ classId: c.id, sectionId: s.id })}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Class dialog */}
      {classDialog && (
        <Dialog title={editingClass ? 'Edit Class' : 'Add Class'} onClose={() => setClassDialog(false)}>
          {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
          <form onSubmit={handleClassSave} className="space-y-3">
            <div><Label>Class Name *</Label><Input value={classForm.name} onChange={e => setClassForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Grade 10" required /></div>
            {!editingClass && (
              <div>
                <Label>Academic Year *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classForm.academicYearId} onChange={e => setClassForm(f => ({ ...f, academicYearId: e.target.value }))} required>
                  <option value="">Select year</option>
                  {acYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
            )}
            <Btns saving={saving} onCancel={() => setClassDialog(false)} label={editingClass ? 'Save Changes' : 'Add Class'} />
          </form>
        </Dialog>
      )}

      {/* Section dialog */}
      {sectionDialog && (
        <Dialog title={editingSection ? 'Edit Section' : 'Add Section'} onClose={() => { setSectionDialog(null); setEditingSection(null); }}>
          {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
          <form onSubmit={e => handleSectionSave(sectionDialog, e)} className="space-y-3">
            <div><Label>Section Name *</Label><Input value={sectionForm.name} onChange={e => setSectionForm(f => ({ ...f, name: e.target.value }))} placeholder="A, B, C..." required /></div>
            <div><Label>Capacity</Label><Input type="number" min={1} value={sectionForm.capacity} onChange={e => setSectionForm(f => ({ ...f, capacity: e.target.value }))} /></div>
            <Btns saving={saving} onCancel={() => { setSectionDialog(null); setEditingSection(null); }} label={editingSection ? 'Save Changes' : 'Add Section'} />
          </form>
        </Dialog>
      )}

      {/* Delete class confirm */}
      {deleteClassId && (
        <ConfirmDelete onConfirm={handleDeleteClass} onCancel={() => setDeleteClassId(null)} deleting={deleting}
          message="Delete this class and all its sections?" />
      )}

      {/* Delete section confirm */}
      {deleteSectionInfo && (
        <ConfirmDelete onConfirm={handleDeleteSection} onCancel={() => setDeleteSectionInfo(null)} deleting={deleting}
          message="Delete this section? Enrolled students will lose their section assignment." />
      )}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Btns({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex gap-2 pt-2">
      <Button type="submit" loading={saving} className="flex-1">{label}</Button>
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function ConfirmDelete({ onConfirm, onCancel, deleting, message }: { onConfirm: () => void; onCancel: () => void; deleting: boolean; message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold mb-2">Confirm Delete</h2>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <div className="flex gap-2">
          <Button variant="destructive" loading={deleting} onClick={onConfirm} className="flex-1">Delete</Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
