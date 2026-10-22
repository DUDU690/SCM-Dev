import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api';
import { BarChart3, Users, GraduationCap, CheckSquare, FileText, DollarSign, Building2 } from 'lucide-react';

const REPORTS = [
  { title: 'Student Report', description: 'List of all enrolled students with class and section details', icon: GraduationCap, endpoint: '/reports/students' },
  { title: 'Faculty Report', description: 'Faculty members and their assigned subjects', icon: Users, endpoint: '/reports/faculty' },
  { title: 'Attendance Report', description: 'Attendance summary by class, section, or student', icon: CheckSquare, endpoint: '/reports/attendance' },
  { title: 'Examination Report', description: 'Exam results, grade distribution, and performance analysis', icon: FileText, endpoint: '/reports/examinations' },
  { title: 'Fee Collection Report', description: 'Fee invoices, payments, and outstanding balances', icon: DollarSign, endpoint: '/reports/fees' },
  { title: 'Admission Report', description: 'Admission applications by status and academic year', icon: BarChart3, endpoint: '/reports/admissions' },
  { title: 'Hostel Report', description: 'Hostel occupancy and room allocation summary', icon: Building2, endpoint: '/reports/hostel' },
];

export default function ReportsPage() {
  async function download(endpoint: string, title: string) {
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports & Exports"
        description="Generate and export data reports"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(r => (
          <Card key={r.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <r.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{r.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{r.description}</p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => download(r.endpoint, r.title)}>
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
