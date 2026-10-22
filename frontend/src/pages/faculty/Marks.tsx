import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Exam { id: string; name: string; class: { name: string }; subjects: { id: string; subject: { id: string; name: string }; maxMarks: number }[] }
interface StudentMark { studentId: string; firstName: string; lastName: string; admissionNumber: string; marksObtained: string }

export default function FacultyMarksPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [loading, setLoading] = useState(false);
  const [examsLoading, setExamsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/examinations').then(r => setExams(r.data.data)).catch(console.error).finally(() => setExamsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedExam || !selectedSubject) return;
    setLoading(true); setSaved(false);
    api.get('/marks', { params: { examinationId: selectedExam, subjectId: selectedSubject } })
      .then(r => {
        const existing: Record<string, string> = {};
        for (const m of r.data.data) existing[m.student.id] = m.marksObtained;

        // Load students for the exam's class
        const exam = exams.find(e => e.id === selectedExam);
        if (!exam) return;
        api.get('/students', { params: { limit: 200 } }).then(sr => {
          setMarks(sr.data.data.map((s: { id: string; firstName: string; lastName: string; admissionNumber: string }) => ({
            studentId: s.id, firstName: s.firstName, lastName: s.lastName, admissionNumber: s.admissionNumber,
            marksObtained: existing[s.id] ?? '',
          })));
        });
      })
      .catch(console.error).finally(() => setLoading(false));
  }, [selectedExam, selectedSubject, exams]);

  async function submit() {
    if (!selectedExam || !selectedSubject) return;
    setSaving(true); setError('');
    try {
      await api.post('/marks/bulk', {
        examinationId: selectedExam, subjectId: selectedSubject,
        marks: marks.filter(m => m.marksObtained !== '').map(m => ({ studentId: m.studentId, marksObtained: parseFloat(m.marksObtained) })),
      });
      setSaved(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  const exam = exams.find(e => e.id === selectedExam);
  const subjects = exam?.subjects ?? [];
  const currentSubject = subjects.find(s => s.subject.id === selectedSubject);

  return (
    <div>
      <PageHeader title="Enter Marks" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Marks' }]} />

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="w-64">
          <Label>Examination</Label>
          {examsLoading ? <LoadingSpinner size="sm" /> : (
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1" value={selectedExam} onChange={e => { setSelectedExam(e.target.value); setSelectedSubject(''); }}>
              <option value="">Select examination</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name} — {e.class?.name}</option>)}
            </select>
          )}
        </div>
        {exam && (
          <div className="w-64">
            <Label>Subject</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm mt-1" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s.subject.id} value={s.subject.id}>{s.subject.name} (Max: {s.maxMarks})</option>)}
            </select>
          </div>
        )}
      </div>

      {selectedExam && selectedSubject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{exam?.name} — {subjects.find(s => s.subject.id === selectedSubject)?.subject.name} (Max: {currentSubject?.maxMarks})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSpinner className="mx-auto" /> : (
              <>
                {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
                {saved && <p className="text-sm text-green-600 mb-3 p-2 bg-green-50 rounded dark:bg-green-950">Marks saved!</p>}
                <div className="space-y-2">
                  {marks.map((m, i) => (
                    <div key={m.studentId} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-muted-foreground">{m.admissionNumber}</p>
                      </div>
                      <input
                        type="number" min={0} max={currentSubject?.maxMarks}
                        className="w-24 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={m.marksObtained}
                        onChange={e => setMarks(ms => ms.map((mm, ii) => ii === i ? { ...mm, marksObtained: e.target.value } : mm))}
                        placeholder={`/ ${currentSubject?.maxMarks}`}
                      />
                    </div>
                  ))}
                </div>
                {marks.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={submit} loading={saving}>Save Marks</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
