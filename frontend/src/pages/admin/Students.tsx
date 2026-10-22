import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Search, Plus, Eye, X, Pencil, Trash2 } from 'lucide-react';

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  bloodGroup?: string;
  nationality?: string;
  user: { email: string };
  enrollments: { section: { name: string; class: { name: string } } }[];
}

interface Paginated { data: Student[]; total: number; page: number; totalPages: number }

const INITIAL_FORM = {
  firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: '', address: '', admissionNumber: '',
  guardian: { firstName: '', lastName: '', relationship: '', phone: '' },
};

const EDIT_FORM_EMPTY = { firstName: '', lastName: '', phone: '', gender: '', dateOfBirth: '', address: '', bloodGroup: '', nationality: '' };

export default function StudentsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<Paginated>({ data: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Add dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  // Edit dialog
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState(EDIT_FORM_EMPTY);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete dialog
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/students', { params: { page, limit: 20, search: search || undefined } })
      .then(r => setState(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await api.post('/students', form);
      setTempPassword(res.data.tempPassword || '');
      setDialogOpen(false); setForm(INITIAL_FORM); load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to add student');
    } finally { setSaving(false); }
  }

  function openEdit(s: Student) {
    setEditStudent(s);
    setEditForm({
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone || '',
      gender: s.gender || '',
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '',
      address: s.address || '',
      bloodGroup: s.bloodGroup || '',
      nationality: s.nationality || '',
    });
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editStudent) return;
    setEditSaving(true); setEditError('');
    try {
      await api.patch(`/students/${editStudent.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone || undefined,
        gender: editForm.gender || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
        address: editForm.address || undefined,
        bloodGroup: editForm.bloodGroup || undefined,
        nationality: editForm.nationality || undefined,
      });
      setEditStudent(null);
      load();
    } catch (err: unknown) {
      setEditError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to update student');
    } finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteStudent) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteStudent.id}`);
      setDeleteStudent(null);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to delete student');
    } finally { setDeleting(false); }
  }

  const columns: Column<Student>[] = [
    { key: 'admissionNumber', header: 'Adm. No.' },
    { key: 'name', header: 'Name', render: r => `${r.firstName} ${r.lastName}` },
    { key: 'email', header: 'Email', render: r => r.user?.email || '—' },
    { key: 'enrollment', header: 'Class / Section', render: r => r.enrollments?.[0] ? `${r.enrollments[0].section.class.name} / ${r.enrollments[0].section.name}` : '—' },
    { key: 'phone', header: 'Phone', render: r => r.phone || '—' },
    {
      key: 'actions', header: '', className: 'w-28',
      render: r => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" title="View Details" onClick={() => navigate(`/students/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(r as unknown as Student)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Delete" onClick={() => setDeleteStudent(r as unknown as Student)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${state.total} students enrolled`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students' }]}
        actions={<Button onClick={() => { setDialogOpen(true); setTempPassword(''); }}><Plus className="h-4 w-4 mr-1" />Add Student</Button>}
      />

      {tempPassword && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md text-sm">
          <p className="font-medium text-green-700 dark:text-green-300">Student added successfully!</p>
          <p className="text-green-600 dark:text-green-400">Temporary password: <strong className="font-mono">{tempPassword}</strong> — share securely with the student.</p>
        </div>
      )}

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input placeholder="Search by name or admission no..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <DataTable
        columns={columns}
        data={state.data as unknown as Record<string, unknown>[]}
        keyField="id"
        isLoading={loading}
        emptyMessage="No students found"
        page={page}
        totalPages={state.totalPages}
        total={state.total}
        onPageChange={setPage}
      />

      {/* ── Add Student Modal ── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Student</h2>
              <button onClick={() => { setDialogOpen(false); setError(''); }}><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name *</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required /></div>
                <div><Label>Last Name *</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required /></div>
              </div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div>
                  <Label>Gender</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>Admission Number (leave blank to auto-generate)</Label><Input value={form.admissionNumber} onChange={e => setForm(f => ({ ...f, admissionNumber: e.target.value }))} /></div>
              <p className="text-sm font-medium pt-2 border-t">Guardian / Parent Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Guardian First Name *</Label><Input value={form.guardian.firstName} onChange={e => setForm(f => ({ ...f, guardian: { ...f.guardian, firstName: e.target.value } }))} required /></div>
                <div><Label>Guardian Last Name *</Label><Input value={form.guardian.lastName} onChange={e => setForm(f => ({ ...f, guardian: { ...f.guardian, lastName: e.target.value } }))} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Relationship *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.guardian.relationship} onChange={e => setForm(f => ({ ...f, guardian: { ...f.guardian, relationship: e.target.value } }))} required>
                    <option value="">Select</option><option value="FATHER">Father</option><option value="MOTHER">Mother</option><option value="GUARDIAN">Guardian</option><option value="OTHER">Other</option>
                  </select>
                </div>
                <div><Label>Guardian Phone *</Label><Input value={form.guardian.phone} onChange={e => setForm(f => ({ ...f, guardian: { ...f.guardian, phone: e.target.value } }))} required /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">Add Student</Button>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Student Modal ── */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Edit Student</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editStudent.admissionNumber}</p>
              </div>
              <button onClick={() => setEditStudent(null)}><X className="h-5 w-5" /></button>
            </div>
            {editError && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{editError}</p>}
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name *</Label><Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} required /></div>
                <div><Label>Last Name *</Label><Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div>
                  <Label>Gender</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div><Label>Date of Birth</Label><Input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} /></div>
              <div><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Blood Group</Label><Input placeholder="e.g. A+" value={editForm.bloodGroup} onChange={e => setEditForm(f => ({ ...f, bloodGroup: e.target.value }))} /></div>
                <div><Label>Nationality</Label><Input value={editForm.nationality} onChange={e => setEditForm(f => ({ ...f, nationality: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={editSaving} className="flex-1">Save Changes</Button>
                <Button type="button" variant="outline" onClick={() => setEditStudent(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Delete Student</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Are you sure you want to delete <strong>{deleteStudent.firstName} {deleteStudent.lastName}</strong>?
            </p>
            <p className="text-xs text-muted-foreground mb-5">This will deactivate their login account. Their academic records are preserved.</p>
            <div className="flex gap-2">
              <Button variant="destructive" loading={deleting} onClick={handleDelete} className="flex-1">Delete Student</Button>
              <Button variant="outline" onClick={() => setDeleteStudent(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
