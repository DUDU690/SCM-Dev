import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/utils';

interface AttendanceSummary { percentage: number; present: number; absent: number; late: number; excused: number; total: number }
interface AttendanceRecord { date: string; status: string; section: string }

export default function StudentAttendancePage() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/attendance/student/me/summary'),
      api.get('/attendance/student/me'),
    ]).then(([s, r]) => { setSummary(s.data.data); setRecords(r.data.data); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  const STATUS_COLOR: Record<string, 'success' | 'destructive' | 'warning' | 'info'> = { PRESENT: 'success', ABSENT: 'destructive', LATE: 'warning', EXCUSED: 'info' };
  const pct = summary?.percentage ?? 0;

  return (
    <div>
      <PageHeader title="My Attendance" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Attendance' }]} />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Attendance', value: `${pct.toFixed(1)}%`, color: pct >= 75 ? 'text-green-600' : 'text-red-600' },
            { label: 'Present', value: summary.present, color: 'text-green-600' },
            { label: 'Absent', value: summary.absent, color: 'text-red-600' },
            { label: 'Late', value: summary.late, color: 'text-yellow-600' },
            { label: 'Excused', value: summary.excused, color: 'text-blue-600' },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Attendance History</CardTitle></CardHeader>
        <CardContent>
          {records.length > 0 ? (
            <div className="space-y-2">
              {records.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{formatDate(r.date)}</p>
                    <p className="text-xs text-muted-foreground">{r.section}</p>
                  </div>
                  <Badge variant={STATUS_COLOR[r.status] ?? 'default'}>{r.status}</Badge>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-muted-foreground py-8">No attendance records found</p>}
        </CardContent>
      </Card>
    </div>
  );
}
