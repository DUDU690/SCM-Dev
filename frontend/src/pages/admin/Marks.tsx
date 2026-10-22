import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Label } from '@/components/ui/Label';

interface Exam { id: string; name: string; class: { name: string } }
interface Subject { id: string; name: string }
interface MarkRow {
  student: { firstName: string; lastName: string; admissionNumber: string };
  subject: { name: string };
  marksObtained: string; grade?: string;
  examinationSubject?: { maxMarks: number }
}

export default function MarksPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [examsLoading, setExamsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/examinations'), api.get('/subjects')])
      .then(([e, s]) => { setExams(e.data.data); setSubjects(s.data.data); })
      .catch(console.error).finally(() => setExamsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    setLoading(true);
    api.get('/marks', { params: { examinationId: selectedExam } })
      .then(r => setMarks(r.data.data))
      .catch(console.error).finally(() => setLoading(false));
  }, [selectedExam]);

  const grouped = marks.reduce<Record<string, MarkRow[]>>((acc, m) => {
    const k = m.student ? `${m.student.firstName} ${m.student.lastName} (${m.student.admissionNumber})` : 'unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(m);
    return acc;
  }, {});

  const subjectNames = [...new Set(marks.map(m => m.subject.name))];

  return (
    <div>
      <PageHeader title="Marks" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Marks' }]} />

      <div className="mb-6 w-72">
        <Label>Select Examination</Label>
        {examsLoading ? <LoadingSpinner size="sm" /> : (
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1"
            value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
          >
            <option value="">Select examination</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.name} — {e.class?.name}</option>)}
          </select>
        )}
      </div>

      {!selectedExam && <p className="text-center text-muted-foreground py-12">Select an examination to view marks</p>}

      {selectedExam && (
        <Card>
          <CardHeader><CardTitle>Marks Sheet</CardTitle></CardHeader>
          <CardContent>
            {loading ? <LoadingSpinner className="mx-auto" /> : marks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No marks entered yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Student</th>
                      <th className="px-3 py-2 text-left font-medium">Adm. No.</th>
                      {subjectNames.map(s => <th key={s} className="px-3 py-2 text-left font-medium">{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(grouped).map(([name, rows]) => (
                      <tr key={name} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2">{rows[0].student?.firstName} {rows[0].student?.lastName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{rows[0].student?.admissionNumber}</td>
                        {subjectNames.map(sn => {
                          const r = rows.find(r => r.subject.name === sn);
                          return <td key={sn} className="px-3 py-2">{r ? `${r.marksObtained}${r.grade ? ` (${r.grade})` : ''}` : '—'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
