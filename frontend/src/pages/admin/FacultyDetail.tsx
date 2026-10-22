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
import { formatDate, getInitials } from '@/lib/utils';
import { ArrowLeft, Edit2, X } from 'lucide-react';

interface FacultyDetail {
  id: string; employeeId: string; firstName: string; lastName: string;
  phone?: string; gender?: string; dateOfBirth?: string; address?: string; photoUrl?: string;
  designation?: string; qualification?: string; joiningDate?: string;
  user: { email: string; isActive: boolean };
  classSubjects: { id: string; subject: { name: string; code: string }; class: { name: string } }[];
}

export default function FacultyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState<FacultyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', gender: '', designation: '', qualification: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = () => {
    api.get(`/faculty/${id}`)
      .then(r => {
        setFaculty(r.data.data);
        const f = r.data.data;
        setEditForm({
          firstName: f.firstName, lastName: f.lastName, phone: f.phone || '',
          gender: f.gender || '', designation: f.designation || '',
          qualification: f.qualification || '', address: f.address || '',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setEditError('');
    try {
      await api.patch(`/faculty/${id}`, {
        ...editForm,
        phone: editForm.phone || undefined,
        gender: editForm.gender || undefined,
        designation: editForm.designation || undefined,
        qualification: editForm.qualification || undefined,
      });
      setEditOpen(false);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setEditError(e.response?.data?.error || 'Failed to update');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;
  if (!faculty) return <p className="text-center text-muted-foreground mt-20">Faculty not found</p>;

  return (
    <div>
      <PageHeader
        title={`${faculty.firstName} ${faculty.lastName}`}
        description={`Employee ID: ${faculty.employeeId}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Faculty', href: '/faculty' }, { label: faculty.firstName }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
            <Button variant="outline" onClick={() => navigate('/faculty')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold overflow-hidden">
                {faculty.photoUrl ? <img src={faculty.photoUrl} className="w-full h-full rounded-full object-cover" alt="Photo" /> : getInitials(faculty.firstName, faculty.lastName)}
              </div>
            </div>
            {[
              ['Email', faculty.user.email],
              ['Phone', faculty.phone || '—'],
              ['Gender', faculty.gender || '—'],
              ['Date of Birth', faculty.dateOfBirth ? formatDate(faculty.dateOfBirth) : '—'],
              ['Designation', faculty.designation || '—'],
              ['Qualification', faculty.qualification || '—'],
              ['Joining Date', faculty.joiningDate ? formatDate(faculty.joiningDate) : '—'],
              ['Address', faculty.address || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Account</span>
              <Badge variant={faculty.user.isActive ? 'success' : 'destructive'}>{faculty.user.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assigned Subjects</CardTitle></CardHeader>
          <CardContent>
            {faculty.classSubjects.length > 0 ? faculty.classSubjects.map(cs => (
              <div key={cs.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{cs.subject.name}</p>
                  <p className="text-xs text-muted-foreground">Code: {cs.subject.code}</p>
                </div>
                <Badge variant="info">{cs.class.name}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">No subjects assigned</p>}
          </CardContent>
        </Card>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Faculty</h2>
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
              <div><Label>Designation</Label><Input value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} /></div>
              <div><Label>Qualification</Label><Input value={editForm.qualification} onChange={e => setEditForm(f => ({ ...f, qualification: e.target.value }))} /></div>
              <div><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">Save Changes</Button>
                <Button type="button" variant="outline" onClick={() => { setEditOpen(false); setEditError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
