import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { getInitials } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { Camera } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '';

interface Profile {
  id: string; email: string; role: string; isActive: boolean;
  student?: { id: string; firstName: string; lastName: string; admissionNumber: string; photoUrl?: string };
  faculty?: { id: string; firstName: string; lastName: string; employeeId: string; photoUrl?: string; designation?: string };
}

export default function SharedProfilePage() {
  const { user } = useAppSelector(s => s.auth);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(r => setProfile(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true); setPhotoError('');
    try {
      const form = new FormData();
      form.append('photo', file);
      const endpoint = profile?.role === 'STUDENT' ? '/students/me/photo' : '/faculty/me/photo';
      const r = await api.post(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const photoUrl = r.data.data.photoUrl;
      setProfile(prev => {
        if (!prev) return prev;
        if (prev.student) return { ...prev, student: { ...prev.student, photoUrl } };
        if (prev.faculty) return { ...prev, faculty: { ...prev.faculty, photoUrl } };
        return prev;
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setPhotoError(e.response?.data?.message || 'Failed to upload photo');
    } finally { setPhotoUploading(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('Passwords do not match'); return; }
    setPwSaving(true); setPwError(''); setPwSuccess(false);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwSuccess(true); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setPwError(e.response?.data?.message || e.response?.data?.error || 'Failed to change password');
    } finally { setPwSaving(false); }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  const displayName = profile?.faculty
    ? `${profile.faculty.firstName} ${profile.faculty.lastName}`
    : profile?.student
    ? `${profile.student.firstName} ${profile.student.lastName}`
    : profile?.email ?? '';

  const initials = profile?.faculty
    ? getInitials(profile.faculty.firstName, profile.faculty.lastName)
    : profile?.student
    ? getInitials(profile.student.firstName, profile.student.lastName)
    : '??';

  const photoUrl = profile?.faculty?.photoUrl || profile?.student?.photoUrl;
  const fullPhotoUrl = photoUrl ? `${API_BASE}${photoUrl}` : null;
  const canUploadPhoto = profile?.role === 'STUDENT' || profile?.role === 'FACULTY';

  return (
    <div>
      <PageHeader title="My Profile" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Profile' }]} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {/* Avatar with upload */}
              <div className="relative shrink-0">
                {fullPhotoUrl ? (
                  <img src={fullPhotoUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                    {initials}
                  </div>
                )}
                {canUploadPhoto && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={photoUploading}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 disabled:opacity-50"
                    title="Upload photo"
                  >
                    {photoUploading ? <LoadingSpinner size="sm" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
              </div>

              <div>
                <p className="font-semibold text-lg">{displayName}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="info">{profile?.role}</Badge>
                  <Badge variant={profile?.isActive ? 'success' : 'destructive'}>{profile?.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>

            {photoError && <p className="text-xs text-destructive">{photoError}</p>}
            {canUploadPhoto && (
              <p className="text-xs text-muted-foreground">Click the camera icon on your avatar to upload a profile photo (max 2MB).</p>
            )}

            {profile?.faculty && (
              <div className="space-y-2 text-sm pt-2 border-t">
                <div className="flex justify-between"><span className="text-muted-foreground">Employee ID</span><span>{profile.faculty.employeeId}</span></div>
                {profile.faculty.designation && <div className="flex justify-between"><span className="text-muted-foreground">Designation</span><span>{profile.faculty.designation}</span></div>}
              </div>
            )}
            {profile?.student && (
              <div className="space-y-2 text-sm pt-2 border-t">
                <div className="flex justify-between"><span className="text-muted-foreground">Admission No.</span><span>{profile.student.admissionNumber}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
          <CardContent>
            {pwError && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-600 mb-3 p-2 bg-green-50 rounded dark:bg-green-950">Password changed successfully!</p>}
            <form onSubmit={changePassword} className="space-y-3">
              <div><Label>Current Password</Label><Input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required /></div>
              <div><Label>New Password</Label><Input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required placeholder="Min 8 chars, 1 uppercase, 1 number" /></div>
              <div><Label>Confirm New Password</Label><Input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} required /></div>
              <Button type="submit" loading={pwSaving} className="w-full">Change Password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
