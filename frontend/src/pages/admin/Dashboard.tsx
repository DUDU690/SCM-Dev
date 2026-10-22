import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  GraduationCap, BookOpen, Users, DollarSign,
  UserPlus, CheckSquare, FileText, TrendingUp,
} from 'lucide-react';

interface DashboardData {
  counts: {
    students: number;
    faculty: number;
    classes: number;
    subjects: number;
    pendingAdmissions: number;
    activeAcademicYear: string | null;
  };
  attendance: { date: string; present: number; absent: number; percentage: number }[];
  feeCollection: { month: string; collected: number; outstanding: number }[];
  recentAdmissions: { id: string; firstName: string; lastName: string; status: string; createdAt: string }[];
  recentAuditLogs: { id: string; action: string; resource: string; createdAt: string; user: { email: string } }[];
  examPerformance: { grade: string; count: number }[];
}

const ADMISSION_STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'destructive',
  ENROLLED: 'success',
  WAITLISTED: 'secondary' as never,
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/admin').then((res) => {
      setData(res.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {data.counts.activeAcademicYear
            ? `Academic Year: ${data.counts.activeAcademicYear}`
            : 'No active academic year set'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={data.counts.students} icon={GraduationCap} color="blue" />
        <StatCard title="Faculty Members" value={data.counts.faculty} icon={BookOpen} color="green" />
        <StatCard title="Classes" value={data.counts.classes} icon={Users} color="purple" />
        <StatCard title="Subjects" value={data.counts.subjects} icon={FileText} color="orange" />
        <StatCard
          title="Pending Admissions"
          value={data.counts.pendingAdmissions}
          icon={UserPlus}
          color="yellow"
          subtitle="Awaiting review"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Weekly Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.attendance.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.attendance}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12 text-sm">No attendance data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Fee collection chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Fee Collection (6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.feeCollection.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.feeCollection}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Line type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12 text-sm">No payment data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exam performance pie */}
        {data.examPerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Grade Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.examPerformance}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    dataKey="count"
                    nameKey="grade"
                    paddingAngle={2}
                  >
                    {data.examPerformance.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${value} students`,
                      props.payload.grade,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
                {data.examPerformance.map((entry, i) => {
                  const total = data.examPerformance.reduce((s, e) => s + e.count, 0);
                  const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="font-medium">{entry.grade}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent admissions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Recent Admissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentAdmissions.length > 0 ? (
              <div className="space-y-3">
                {data.recentAdmissions.map((a) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{a.firstName} {a.lastName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
                    </div>
                    <Badge variant={ADMISSION_STATUS_COLORS[a.status] ?? 'default'}>
                      {a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No recent admissions</p>
            )}
          </CardContent>
        </Card>

        {/* Recent audit logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentAuditLogs.length > 0 ? (
              <div className="space-y-3">
                {data.recentAuditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="text-sm">
                    <p className="font-medium truncate">{log.action} · {log.resource}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.user?.email || '—'} · {formatDate(log.createdAt, 'dd MMM HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
