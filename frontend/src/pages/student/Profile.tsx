import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatDate, getInitials } from '@/lib/utils';
import { Camera, Loader2 } from 'lucide-react';

interface StudentInfo {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  photoUrl?: string;
  bloodGroup?: string;
  guardians?: { firstName: string; lastName: string; relationship: string; phone: string; email?: string }[];
  enrollments?: { section: { name: string; class: { name: string } }; academicYear: { name: string }; rollNumber?: string }[];
}

interface AuthMe {
  id: string;
  email: string;
  role: string;
  student?: StudentInfo;
}

export default function StudentProfilePage() {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/auth/me').then(r => {
      const data: AuthMe = r.data.data;
      setMe(data);
      setPhotoUrl(data.student?.photoUrl);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be under 2 MB');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post('/students/me/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoUrl(res.data.data.photoUrl);
    } catch (err: unknown) {
      setUploadError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;
  if (!me?.student) return <p className="text-center text-muted-foreground py-12">Student profile not found.</p>;

  const s = me.student;

  return (
    <div>
      <PageHeader title="My Profile" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Profile' }]} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">

            {/* ── Avatar with upload button ── */}
            <div className="flex flex-col items-center mb-4 gap-2">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold overflow-hidden ring-2 ring-primary/20">
                  {photoUrl
                    ? <img src={photoUrl} className="w-full h-full object-cover" alt="Profile" />
                    : <span>{getInitials(s.firstName, s.lastName)}</span>}
                </div>

                {/* Camera overlay */}
                <button
                  type="button"
                  title="Change profile picture"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
                >
                  {uploading
                    ? <Loader2 className="h-5 w-5 text-white animate-spin opacity-0 group-hover:opacity-100" />
                    : <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>

                {/* Upload badge */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  title="Upload photo"
                >
                  {uploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              <div className="text-center">
                <p className="font-semibold">{s.firstName} {s.lastName}</p>
                <p className="text-xs text-muted-foreground">{s.admissionNumber}</p>
              </div>

              {uploadError && (
                <p className="text-xs text-destructive text-center bg-destructive/10 px-3 py-1 rounded-full">{uploadError}</p>
              )}
              <p className="text-xs text-muted-foreground">Click the camera icon to update your photo · max 2 MB</p>
            </div>

            {[
              ['Admission No.', s.admissionNumber],
              ['Full Name', `${s.firstName} ${s.lastName}`],
              ['Email', me.email],
              ['Phone', s.phone || '—'],
              ['Gender', s.gender || '—'],
              ['Date of Birth', s.dateOfBirth ? formatDate(s.dateOfBirth) : '—'],
              ['Blood Group', s.bloodGroup || '—'],
              ['Address', s.address || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right max-w-xs">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Current Enrollment</CardTitle></CardHeader>
            <CardContent>
              {(s.enrollments?.length ?? 0) > 0
                ? s.enrollments!.map((e, i) => (
                  <div key={i} className="py-2 border-b last:border-0 text-sm">
                    <p className="font-medium">{e.section.class.name} — Section {e.section.name}</p>
                    <p className="text-muted-foreground">
                      {e.academicYear.name}{e.rollNumber ? ` · Roll: ${e.rollNumber}` : ''}
                    </p>
                  </div>
                ))
                : <p className="text-sm text-muted-foreground">No enrollments found.</p>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Guardians</CardTitle></CardHeader>
            <CardContent>
              {(s.guardians?.length ?? 0) > 0
                ? s.guardians!.map((g, i) => (
                  <div key={i} className="py-2 border-b last:border-0 text-sm">
                    <p className="font-medium">
                      {g.firstName} {g.lastName}{' '}
                      <span className="text-muted-foreground">({g.relationship})</span>
                    </p>
                    <p className="text-muted-foreground">{g.phone}{g.email ? ` · ${g.email}` : ''}</p>
                  </div>
                ))
                : <p className="text-sm text-muted-foreground">No guardians on record.</p>
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
