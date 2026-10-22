import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';

interface Student { id: string; admissionNumber: string; firstName: string; lastName: string; phone?: string; enrollments: { section: { name: string; class: { name: string } } }[] }

export default function FacultyStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/students', { params: { limit: 200 } }).then(r => setStudents(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const columns: Column<Student>[] = [
    { key: 'admissionNumber', header: 'Adm. No.' },
    { key: 'name', header: 'Name', render: r => `${r.firstName} ${r.lastName}` },
    { key: 'enrollment', header: 'Class / Section', render: r => r.enrollments[0] ? <Badge variant="info">{r.enrollments[0].section.class.name} / {r.enrollments[0].section.name}</Badge> : '—' },
    { key: 'phone', header: 'Phone', render: r => r.phone || '—' },
  ];

  return (
    <div>
      <PageHeader title="My Students" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students' }]} />
      <DataTable columns={columns} data={students as unknown as Record<string, unknown>[]} keyField="id" isLoading={loading} emptyMessage="No students found" />
    </div>
  );
}
