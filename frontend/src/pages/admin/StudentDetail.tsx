import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { formatDate, formatCurrency, getInitials } from '@/lib/utils';
import { ArrowLeft, Edit2, UserPlus, X } from 'lucide-react';

interface StudentDetail {
  id: string; admissionNumber: string; firstName: string; lastName: string;
  phone?: string; gender?: string; dateOfBirth?: string; address?: string; photoUrl?: string; bloodGroup?: string;
  user: { email: string; isActive: boolean; lastLoginAt?: string };
  guardians: { id: string; firstName: string; lastName: string; relationship: string; phone: string; email?: string }[];
  enrollments: { id: string; section: { name: string; class: { name: string } }; academicYear: { name: string }; rollNumber?: string; isActive: boolean }[];
  feeInvoices: { id: string; invoiceNumber: string; totalAmount: string; paidAmount: string; status: string; dueDate?: string }[];
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'destructive' | 'warning'> = {
  PAID: 'success', PENDING: 'warning', OVERDUE: 'destructive', PARTIAL: 'warning', WAIVED: 'default',
};

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', gender: '', dateOfBirth: '', address: '', bloodGroup: '' });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; sections: { id: string; name: string }[] }[]>([]);
  const [enrollForm, setEnrollForm] = useState({ academicYearId: '', classId: '', sectionId: '', rollNumber: '' });
  const [enrollError, setEnrollError] = useState('');

  const load = () => {
    api.get(`/students/${id}`)
      .then(r => {
        setStudent(r.data.data);
        const s = r.data.data;
        setEditForm({
          firstName: s.firstName, lastName: s.lastName, phone: s.phone || '',
          gender: s.gender || '', dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '',
          address: s.address || '', bloodGroup: s.bloodGroup || '',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    api.get('/academic-years').then(r => setAcademicYears(r.data.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!enrollForm.academicYearId) return;
    api.get('/classes', { params: { academicYearId: enrollForm.academicYearId } })
      .then(r => setClasses(r.data.data))
      .catch(console.error);
  }, [enrollForm.academicYearId]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setEditError('');
    try {
      await api.patch(`/students/${id}`, {
        ...editForm,
        phone: editForm.phone || undefined,
        gender: editForm.gender || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
        bloodGroup: editForm.bloodGroup || undefined,
      });
      setEditOpen(false);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setEditError(e.response?.data?.error || 'Failed to update');
    } finally { setSaving(false); }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setEnrollError('');
    try {
      await api.post(`/students/${id}/enroll`, {
        sectionId: enrollForm.sectionId,
        academicYearId: enrollForm.academicYearId,
        rollNumber: enrollForm.rollNumber || undefined,
      });
      setEnrollOpen(false);
      setEnrollForm({ academicYearId: '', classId: '', sectionId: '', rollNumber: '' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setEnrollError(e.response?.data?.error || 'Failed to enroll');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;
  if (!student) return <p className="text-center text-muted-foreground mt-20">Student not found</p>;

  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  const guardians = Array.isArray(student.guardians) ? student.guardians : [];
  const feeInvoices = Array.isArray(student.feeInvoices) ? student.feeInvoices : [];

  const selectedClass = classes.find(c => c.id === enrollForm.classId);

  return (
    <div>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={`Admission No: ${student.admissionNumber}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/students' }, { label: student.firstName }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)}><UserPlus className="h-4 w-4 mr-1" />Enroll</Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
            <Button variant="outline" onClick={() => navigate('/students')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold overflow-hidden">
                {student.photoUrl ? <img src={student.photoUrl} className="w-full h-full rounded-full object-cover" alt="Photo" /> : getInitials(student.firstName, student.lastName)}
              </div>
            </div>
            <Row label="Email" value={student.user.email} />
            <Row label="Phone" value={student.phone || '—'} />
            <Row label="Gender" value={student.gender || '—'} />
            <Row label="Date of Birth" value={student.dateOfBirth ? formatDate(student.dateOfBirth) : '—'} />
            <Row label="Blood Group" value={student.bloodGroup || '—'} />
            <Row label="Address" value={student.address || '—'} />
            <Row label="Account" value={<Badge variant={student.user.isActive ? 'success' : 'destructive'}>{student.user.isActive ? 'Active' : 'Inactive'}</Badge>} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Enrollments</CardTitle></CardHeader>
            <CardContent>
              {enrollments.length > 0 ? enrollments.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{e.section.class.name} — {e.section.name}</p>
                    <p className="text-xs text-muted-foreground">{e.academicYear.name}{e.rollNumber ? ` · Roll: ${e.rollNumber}` : ''}</p>
                  </div>
                  <Badge variant={e.isActive ? 'success' : 'secondary'}>{e.isActive ? 'Active' : 'Past'}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">No enrollments. Use Enroll button to add.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Guardians</CardTitle></CardHeader>
            <CardContent>
              {guardians.length > 0 ? guardians.map(g => (
                <div key={g.id} className="py-2 border-b last:border-0">
                  <p className="text-sm font-medium">{g.firstName} {g.lastName} <span className="text-muted-foreground">({g.relationship})</span></p>
                  <p className="text-xs text-muted-foreground">{g.phone}{g.email ? ` · ${g.email}` : ''}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No guardians</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Fee Invoices</CardTitle></CardHeader>
          <CardContent>
            {feeInvoices.length > 0 ? feeInvoices.map(inv => (
              <div key={inv.id} className="py-2 border-b last:border-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                  <Badge variant={STATUS_COLOR[inv.status] ?? 'default'}>{inv.status}</Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                  <span>Total: {formatCurrency(Number(inv.totalAmount))}</span>
                  <span>Paid: {formatCurrency(Number(inv.paidAmount))}</span>
                </div>
                {inv.dueDate && <p className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)}</p>}
              </div>
            )) : <p className="text-sm text-muted-foreground">No invoices</p>}
          </CardContent>
        </Card>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Student</h2>
              <button onClick={() => { setEditOpen(false); setEditError(''); }}><X className="h-5 w-5" /></button>
            </div>
            {editError && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{editError}</p>}
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name *</Label><Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} required /></div>
                <div><Label>Last Name *</Label><Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} required /></div>
              </div>
              <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div>
                <Label>Gender</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date of Birth</Label><Input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} /></div>
                <div><Label>Blood Group</Label><Input placeholder="e.g. A+" value={editForm.bloodGroup} onChange={e => setEditForm(f => ({ ...f, bloodGroup: e.target.value }))} /></div>
              </div>
              <div><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">Save Changes</Button>
                <Button type="button" variant="outline" onClick={() => { setEditOpen(false); setEditError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {enrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Enroll Student</h2>
              <button onClick={() => { setEnrollOpen(false); setEnrollError(''); }}><X className="h-5 w-5" /></button>
            </div>
            {enrollError && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{enrollError}</p>}
            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <Label>Academic Year *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={enrollForm.academicYearId} onChange={e => setEnrollForm(f => ({ ...f, academicYearId: e.target.value, classId: '', sectionId: '' }))} required>
                  <option value="">Select academic year</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Class *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={enrollForm.classId} onChange={e => setEnrollForm(f => ({ ...f, classId: e.target.value, sectionId: '' }))} required disabled={!enrollForm.academicYearId}>
                  <option value="">Select class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Section *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={enrollForm.sectionId} onChange={e => setEnrollForm(f => ({ ...f, sectionId: e.target.value }))} required disabled={!enrollForm.classId}>
                  <option value="">Select section</option>
                  {(selectedClass?.sections ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><Label>Roll Number (optional)</Label><Input value={enrollForm.rollNumber} onChange={e => setEnrollForm(f => ({ ...f, rollNumber: e.target.value }))} placeholder="e.g. 01" /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1" disabled={!enrollForm.sectionId}>Enroll</Button>
                <Button type="button" variant="outline" onClick={() => { setEnrollOpen(false); setEnrollError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
