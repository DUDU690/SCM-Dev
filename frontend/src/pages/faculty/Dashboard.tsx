import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, Users, FileText, Clock, CheckSquare } from 'lucide-react';

interface ClassSubject {
  id: string;
  class: { id: string; name: string };
  subject: { id: string; name: string; code: string };
}

interface TimetableSlot {
  id: string; startTime: string; endTime: string; dayOfWeek: string; room?: string;
  subject: { name: string };
  section: { name: string; class: { name: string } };
}

interface FacultyInfo {
  id: string; firstName: string; lastName: string; employeeId: string; designation?: string;
}

interface DashboardData {
  faculty: FacultyInfo;
  assignedSubjects: number;
  classSubjects: ClassSubject[];
  todaySchedule: TimetableSlot[];
  pendingMarkExaminations: number;
}

export default function FacultyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/faculty')
      .then(r => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>;
  if (!data) return <p className="text-center text-muted-foreground mt-20">Could not load dashboard.</p>;

  const uniqueClasses = new Set(data.classSubjects.map(cs => cs.class.id)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {data.faculty.firstName}!</h1>
        <p className="text-muted-foreground text-sm">
          {data.faculty.designation || 'Faculty'} · Employee ID: {data.faculty.employeeId}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Assigned Classes" value={uniqueClasses} icon={BookOpen} color="blue" />
        <StatCard title="Assigned Subjects" value={data.assignedSubjects} icon={FileText} color="green" />
        <StatCard title="Pending Mark Entry" value={data.pendingMarkExaminations} icon={CheckSquare} color="yellow" subtitle="Exams awaiting marks" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {data.todaySchedule.length > 0 ? (
              <div className="space-y-3">
                {data.todaySchedule.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{s.subject?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.section?.class?.name} — {s.section?.name}
                        {s.room ? ` · Room ${s.room}` : ''}
                      </p>
                    </div>
                    <Badge variant="info">{s.startTime} – {s.endTime}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">No classes scheduled today</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />My Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            {data.classSubjects.length > 0 ? (
              <div className="space-y-2">
                {data.classSubjects.map(cs => (
                  <div key={cs.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{cs.subject?.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {cs.subject?.code}</p>
                    </div>
                    <Badge variant="info">{cs.class?.name}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">No subjects assigned yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
