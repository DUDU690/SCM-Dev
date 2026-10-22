import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface SubjectMark { subjectName: string; marksObtained: string; maxMarks: number; grade?: string }
interface ExamResult { examinationId: string; examinationName: string; marks: SubjectMark[] }

export default function StudentResultsPage() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/marks/my-results').then(r => setResults(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div>
      <PageHeader title="My Results" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Results' }]} />

      {results.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">No published results yet</p>
      ) : (
        <div className="space-y-6">
          {results.map(exam => {
            const total = exam.marks.reduce((acc, m) => acc + parseFloat(m.marksObtained), 0);
            const maxTotal = exam.marks.reduce((acc, m) => acc + m.maxMarks, 0);
            const pct = maxTotal > 0 ? (total / maxTotal * 100).toFixed(1) : '—';
            return (
              <Card key={exam.examinationId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{exam.examinationName}</CardTitle>
                    <div className="text-right">
                      <p className="text-lg font-bold">{total}/{maxTotal}</p>
                      <p className="text-sm text-muted-foreground">{pct}%</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Subject</th>
                          <th className="px-3 py-2 text-center font-medium">Marks</th>
                          <th className="px-3 py-2 text-center font-medium">Max</th>
                          <th className="px-3 py-2 text-center font-medium">%</th>
                          <th className="px-3 py-2 text-center font-medium">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exam.marks.map((m, i) => {
                          const subPct = ((parseFloat(m.marksObtained) / m.maxMarks) * 100).toFixed(0);
                          return (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-2 font-medium">{m.subjectName}</td>
                              <td className="px-3 py-2 text-center">{m.marksObtained}</td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{m.maxMarks}</td>
                              <td className="px-3 py-2 text-center">{subPct}%</td>
                              <td className="px-3 py-2 text-center">{m.grade ? <Badge variant="success">{m.grade}</Badge> : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
