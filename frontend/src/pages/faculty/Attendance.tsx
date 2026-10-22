import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Section { id: string; name: string; class: { name: string } }
interface StudentRow { id: string; admissionNumber: string; firstName: string; lastName: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' }

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

export default function FacultyAttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [date, setDate] = useState(today);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/faculty/my-sections').then(r => setSections(r.data.data)).catch(console.error).finally(() => setSectionsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSection) return;
    setLoading(true); setSaved(false); setError('');

    Promise.all([
      api.get('/students', { params: { sectionId: selectedSection, limit: 100 } }),
      api.get(`/attendance/section/${selectedSection}`, { params: { from: date, to: date } }),
    ])
      .then(([studentRes, attRes]) => {
        const studentList: { id: string; admissionNumber: string; firstName: string; lastName: string }[] =
          studentRes.data.data ?? [];
        const existingRecords: { student: { id: string }; status: StudentRow['status'] }[] =
          attRes.data.data?.[0]?.records ?? [];

        const statusMap: Record<string, StudentRow['status']> = {};
        for (const r of existingRecords) statusMap[r.student.id] = r.status;

        setStudents(studentList.map(s => ({ ...s, status: statusMap[s.id] ?? 'PRESENT' })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedSection, date]);

  function setStatus(id: string, status: StudentRow['status']) {
    setStudents(s => s.map(st => st.id === id ? { ...st, status } : st));
  }

  function markAll(status: StudentRow['status']) {
    setStudents(s => s.map(st => ({ ...st, status })));
  }

  async function submit() {
    if (!selectedSection) return;
    setSaving(true); setError('');
    try {
      await api.post('/attendance', {
        sectionId: selectedSection, date,
        records: students.map(s => ({ studentId: s.id, status: s.status })),
      });
      setSaved(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Take Attendance" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Attendance' }]} />

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="w-64">
          <Label>Section</Label>
          {sectionsLoading ? <LoadingSpinner size="sm" /> : (
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
              <option value="">Select section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.class.name} — Section {s.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            min={today}
            max={today}
            onChange={e => setDate(e.target.value)}
            className="mt-1 w-44"
          />
        </div>
      </div>

      {selectedSection && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {sections.find(s => s.id === selectedSection)?.class.name} / Section {sections.find(s => s.id === selectedSection)?.name} — {date}
              </CardTitle>
              <div className="flex gap-2">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => markAll(s)} className="text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors">{s === 'PRESENT' ? 'All P' : s === 'ABSENT' ? 'All A' : s[0]}</button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSpinner className="mx-auto" /> : (
              <>
                {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
                {saved && <p className="text-sm text-green-600 mb-3 p-2 bg-green-50 rounded dark:bg-green-950">Attendance saved successfully!</p>}
                <div className="space-y-2">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-muted-foreground">{s.admissionNumber}</p>
                      </div>
                      <div className="flex gap-1">
                        {STATUSES.map(status => (
                          <button
                            key={status}
                            onClick={() => setStatus(s.id, status)}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              s.status === status
                                ? status === 'PRESENT' ? 'bg-green-600 text-white'
                                : status === 'ABSENT' ? 'bg-red-600 text-white'
                                : status === 'LATE' ? 'bg-yellow-600 text-white'
                                : 'bg-blue-600 text-white'
                                : 'border border-input hover:bg-accent'
                            }`}
                          >
                            {status[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {students.length > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{students.filter(s => s.status === 'PRESENT').length} present / {students.length} total</p>
                    <Button onClick={submit} loading={saving}>Save Attendance</Button>
                  </div>
                )}
                {students.length === 0 && <p className="text-center text-muted-foreground py-8">No students in this section</p>}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
