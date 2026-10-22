import { useEffect, useState } from 'react';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatCurrency } from '@/lib/utils';
import { CheckSquare, FileText, DollarSign, Clock, Bell } from 'lucide-react';

interface Enrollment {
  rollNumber?: string;
  section: { name: string; class: { name: string } };
  academicYear: { name: string };
}

interface FeeInvoice {
  id: string; invoiceNumber: string;
  totalAmount: string; paidAmount: string;
  status: string; dueDate?: string;
}

interface TimetableSlot {
  id: string; startTime: string; endTime: string;
  subject: { name: string };
  faculty?: { firstName: string; lastName: string };
  room?: string;
}

interface Exam { id: string; name: string; startDate: string }

interface DashboardData {
  student: { firstName: string; lastName: string; admissionNumber: string };
  enrollment: Enrollment | null;
  attendance: { total: number; present: number; late: number; absent: number; percentage: number };
  upcomingExams: Exam[];
  feeInvoices: FeeInvoice[];
  unreadNotifications: number;
  todaySchedule: TimetableSlot[];
}

export default function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/student')
      .then(r => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>;
  if (!data) return <p className="text-center text-muted-foreground mt-20">Could not load dashboard.</p>;

  const att = data.attendance ?? { total: 0, present: 0, late: 0, absent: 0, percentage: 0 };
  const pct = Number(att?.percentage ?? 0);
  const attColor = pct >= 75 ? 'green' : pct >= 60 ? 'yellow' : 'red';

  const feeInvoices = Array.isArray(data.feeInvoices) ? data.feeInvoices : [];
  const upcomingExams = Array.isArray(data.upcomingExams) ? data.upcomingExams : [];
  const todaySchedule = Array.isArray(data.todaySchedule) ? data.todaySchedule : [];

  const totalDue = feeInvoices.reduce((s, inv) => s + Number(inv.totalAmount), 0);
  const totalPaid = feeInvoices.reduce((s, inv) => s + Number(inv.paidAmount), 0);
  const outstanding = totalDue - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {data.student.firstName}!</h1>
        {data.enrollment ? (
          <p className="text-muted-foreground text-sm">
            {data.enrollment.section.class.name} — {data.enrollment.section.name} · {data.enrollment.academicYear.name}
            {data.enrollment.rollNumber && ` · Roll: ${data.enrollment.rollNumber}`}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Adm: {data.student.admissionNumber} — not yet enrolled in a section</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Attendance"
          value={`${pct.toFixed(1)}%`}
          subtitle={`${(att.present ?? 0) + (att.late ?? 0)} present / ${att.absent ?? 0} absent of ${att.total ?? 0}`}
          icon={CheckSquare}
          color={attColor}
        />
        <StatCard
          title="Outstanding Fees"
          value={formatCurrency(outstanding)}
          subtitle={`Paid: ${formatCurrency(totalPaid)}`}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          title="Upcoming Exams"
          value={upcomingExams.length}
          subtitle={(data.unreadNotifications ?? 0) > 0 ? `${data.unreadNotifications} unread notifications` : 'No unread notifications'}
          icon={FileText}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Today's Timetable</CardTitle></CardHeader>
          <CardContent>
            {todaySchedule.length > 0 ? (
              <div className="space-y-2">
                {todaySchedule.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{s.subject?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.faculty ? `${s.faculty.firstName} ${s.faculty.lastName}` : ''}
                        {s.room ? ` · Room ${s.room}` : ''}
                      </p>
                    </div>
                    <Badge variant="info">{s.startTime} – {s.endTime}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">No classes today</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Upcoming Examinations</CardTitle></CardHeader>
          <CardContent>
            {upcomingExams.length > 0 ? (
              <div className="space-y-2">
                {upcomingExams.map(e => (
                  <div key={e.id} className="flex items-center justify-between">
                    <p className="text-sm font-medium">{e.name}</p>
                    <Badge variant="warning">{formatDate(e.startDate)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">No upcoming exams</p>
            )}
          </CardContent>
        </Card>

        {feeInvoices.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Recent Invoices</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {feeInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{inv.invoiceNumber}</p>
                      {inv.dueDate && <p className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(inv.totalAmount))}</p>
                      <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'destructive' : 'warning'} className="text-[10px]">{inv.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.unreadNotifications > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" />Notifications</CardTitle></CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground text-sm py-4">
                You have <strong>{data.unreadNotifications}</strong> unread notification{data.unreadNotifications !== 1 ? 's' : ''}.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
