import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { formatDate } from '@/lib/utils';

interface Section { id: string; name: string; class: { name: string } }
interface AttendanceRecord {
  id: string; date: string;
  records: { student: { firstName: string; lastName: string; admissionNumber: string }; status: string }[];
}

const STATUS_COLOR: Record<string, 'success' | 'destructive' | 'warning' | 'info'> = {
  PRESENT: 'success', ABSENT: 'destructive', LATE: 'warning', EXCUSED: 'info',
};

export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  useEffect(() => {
    api.get('/classes').then(r => {
      const sections: Section[] = [];
      for (const c of (r.data.data ?? [])) {
        for (const s of (c.sections ?? [])) sections.push({ ...s, class: { name: c.name } });
      }
      setSections(sections);
    }).catch(console.error).finally(() => setSectionsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSection) return;
    setLoading(true);
    api.get(`/attendance/section/${selectedSection}`, { params: { from: selectedDate, to: selectedDate } })
      .then(r => setAttendance((r.data.data ?? [])[0] ?? null))
      .catch(() => setAttendance(null))
      .finally(() => setLoading(false));
  }, [selectedSection, selectedDate]);

  return (
    <div>
      <PageHeader title="Attendance" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Attendance' }]} />

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="w-64">
          <Label>Section</Label>
          {sectionsLoading ? <LoadingSpinner size="sm" /> : (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1"
              value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
            >
              <option value="">Select section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.class.name} — Section {s.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={selectedDate}
            max={today}
            onChange={e => setSelectedDate(e.target.value)}
            className="mt-1 w-44"
          />
        </div>
      </div>

      {!selectedSection && <p className="text-center text-muted-foreground py-12">Select a section to view attendance</p>}

      {selectedSection && (
        <Card>
          <CardHeader>
            <CardTitle>
              Attendance — {sections.find(s => s.id === selectedSection)?.class.name} / Section {sections.find(s => s.id === selectedSection)?.name} · {formatDate(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSpinner className="mx-auto" /> : attendance ? (
              <div className="space-y-2">
                <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                  <span className="text-green-600">Present: {(attendance.records ?? []).filter(r => r.status === 'PRESENT').length}</span>
                  <span className="text-red-600">Absent: {(attendance.records ?? []).filter(r => r.status === 'ABSENT').length}</span>
                  <span className="text-yellow-600">Late: {(attendance.records ?? []).filter(r => r.status === 'LATE').length}</span>
                  <span className="text-blue-600">Excused: {(attendance.records ?? []).filter(r => r.status === 'EXCUSED').length}</span>
                </div>
                {(attendance.records ?? []).map((rec, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{rec.student?.firstName} {rec.student?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{rec.student?.admissionNumber}</p>
                    </div>
                    <Badge variant={STATUS_COLOR[rec.status] ?? 'default'}>{rec.status}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">No attendance recorded for this date</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
