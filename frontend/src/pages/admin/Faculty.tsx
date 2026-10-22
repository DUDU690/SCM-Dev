import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Search, Plus, Eye, X, Pencil, Trash2 } from 'lucide-react';

interface Faculty {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation?: string;
  qualification?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  user: { email: string };
  classSubjects: { subject: { name: string } }[];
}

const INITIAL_FORM = { firstName: '', lastName: '', email: '', phone: '', employeeId: '', designation: '', qualification: '', gender: '' };
const EDIT_FORM_EMPTY = { firstName: '', lastName: '', phone: '', gender: '', dateOfBirth: '', address: '', qualification: '', designation: '' };

export default function FacultyPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Faculty[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
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
  const [editFaculty, setEditFaculty] = useState<Faculty | null>(null);
  const [editForm, setEditForm] = useState(EDIT_FORM_EMPTY);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete dialog
  const [deleteFaculty, setDeleteFaculty] = useState<Faculty | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/faculty', { params: { page, limit: 20, search: search || undefined } })
      .then(r => { setData(r.data.data); setTotal(r.data.total); setTotalPages(r.data.totalPages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await api.post('/faculty', form);
      setTempPassword(res.data.tempPassword || '');
      setDialogOpen(false); setForm(INITIAL_FORM); load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to add faculty');
    } finally { setSaving(false); }
  }

  function openEdit(f: Faculty) {
    setEditFaculty(f);
    setEditForm({
      firstName: f.firstName,
      lastName: f.lastName,
      phone: f.phone || '',
      gender: f.gender || '',
      dateOfBirth: f.dateOfBirth ? f.dateOfBirth.split('T')[0] : '',
      address: f.address || '',
      qualification: f.qualification || '',
      designation: f.designation || '',
    });
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editFaculty) return;
    setEditSaving(true); setEditError('');
    try {
      await api.patch(`/faculty/${editFaculty.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone || undefined,
        gender: editForm.gender || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
        address: editForm.address || undefined,
        qualification: editForm.qualification || undefined,
        designation: editForm.designation || undefined,
      });
      setEditFaculty(null);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setEditError(e.response?.data?.error || 'Failed to update faculty');
    } finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteFaculty) return;
    setDeleting(true);
    try {
      await api.delete(`/faculty/${deleteFaculty.id}`);
      setDeleteFaculty(null);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Failed to delete faculty');
    } finally { setDeleting(false); }
  }

  const columns: Column<Faculty>[] = [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'name', header: 'Name', render: r => `${r.firstName} ${r.lastName}` },
    { key: 'email', header: 'Email', render: r => r.user?.email || '—' },
    { key: 'designation', header: 'Designation', render: r => r.designation || '—' },
    { key: 'subjects', header: 'Subjects', render: r => r.classSubjects.length > 0 ? r.classSubjects.map(cs => cs.subject.name).join(', ') : '—' },
    {
      key: 'actions', header: '', className: 'w-28',
      render: r => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" title="View Details" onClick={() => navigate(`/faculty/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(r as unknown as Faculty)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Delete" onClick={() => setDeleteFaculty(r as unknown as Faculty)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Faculty"
        description={`${total} faculty members`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Faculty' }]}
        actions={<Button onClick={() => { setDialogOpen(true); setTempPassword(''); }}><Plus className="h-4 w-4 mr-1" />Add Faculty</Button>}
      />

      {tempPassword && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md text-sm">
          <p className="font-medium text-green-700 dark:text-green-300">Faculty added successfully!</p>
          <p className="text-green-600 dark:text-green-400">Temporary password: <strong className="font-mono">{tempPassword}</strong> — share securely with the faculty member.</p>
        </div>
      )}

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input placeholder="Search faculty..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        keyField="id"
        isLoading={loading}
        emptyMessage="No faculty found"
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {/* ── Add Faculty Modal ── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Faculty</h2>
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
                <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
              <div><Label>Qualification</Label><Input value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} /></div>
              <div>
                <Label>Gender</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">Add Faculty</Button>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Faculty Modal ── */}
      {editFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Edit Faculty</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editFaculty.employeeId}</p>
              </div>
              <button onClick={() => setEditFaculty(null)}><X className="h-5 w-5" /></button>
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
                <div><Label>Qualification</Label><Input value={editForm.qualification} onChange={e => setEditForm(f => ({ ...f, qualification: e.target.value }))} /></div>
                <div><Label>Designation</Label><Input value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={editSaving} className="flex-1">Save Changes</Button>
                <Button type="button" variant="outline" onClick={() => setEditFaculty(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Delete Faculty</h2>
            <p className="text-sm text-muted-foreground mb-1">
              Are you sure you want to delete <strong>{deleteFaculty.firstName} {deleteFaculty.lastName}</strong>?
            </p>
            <p className="text-xs text-muted-foreground mb-5">This will deactivate their login account. Their teaching and attendance records are preserved.</p>
            <div className="flex gap-2">
              <Button variant="destructive" loading={deleting} onClick={handleDelete} className="flex-1">Delete Faculty</Button>
              <Button variant="outline" onClick={() => setDeleteFaculty(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
