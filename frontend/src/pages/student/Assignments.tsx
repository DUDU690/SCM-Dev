import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/utils';
import { Calendar, BookOpen } from 'lucide-react';

interface Assignment {
  id: string; title: string; description: string; dueDate: string; maxMarks?: number;
  subject: { name: string };
  faculty: { firstName: string; lastName: string };
  submission?: { submittedAt: string; marksAwarded?: number; feedback?: string } | null;
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/assignments/student').then(r => setAssignments(r.data.data ?? [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  const now = new Date();
  const pending = assignments.filter(a => !a.submission && new Date(a.dueDate) >= now);
  const overdue = assignments.filter(a => !a.submission && new Date(a.dueDate) < now);
  const submitted = assignments.filter(a => !!a.submission);

  function Section({ title, items, color }: { title: string; items: Assignment[]; color: string }) {
    return items.length > 0 ? (
      <div>
        <h2 className={`text-sm font-semibold mb-3 ${color}`}>{title} ({items.length})</h2>
        <div className="space-y-3">
          {items.map(a => (
            <Card key={a.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{a.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{a.description}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Subject: {a.subject.name}</span>
                      {a.faculty && <span>By: {a.faculty.firstName} {a.faculty.lastName}</span>}
                      {a.maxMarks && <span>Max Marks: {a.maxMarks}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(a.dueDate)}</span>
                    </div>
                    {a.submission ? (
                      <div>
                        <Badge variant="success">Submitted</Badge>
                        {a.submission.marksAwarded !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">Marks: {a.submission.marksAwarded}/{a.maxMarks}</p>
                        )}
                      </div>
                    ) : new Date(a.dueDate) < now ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </div>
                </div>
                {a.submission?.feedback && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Feedback</p>
                    <p>{a.submission.feedback}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    ) : null;
  }

  return (
    <div>
      <PageHeader title="Assignments" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Assignments' }]} />
      {assignments.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No assignments yet</p>
      ) : (
        <div className="space-y-8">
          <Section title="Pending" items={pending} color="text-yellow-600" />
          <Section title="Overdue" items={overdue} color="text-red-600" />
          <Section title="Submitted" items={submitted} color="text-green-600" />
        </div>
      )}
    </div>
  );
}
