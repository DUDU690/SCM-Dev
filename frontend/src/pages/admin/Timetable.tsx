import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { Clock } from 'lucide-react';

interface Timetable { id: string; name: string; isActive: boolean; class: { name: string }; academicYear: { name: string }; slots: { id: string }[] }

export default function TimetablePage() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timetables').then(r => setTimetables(r.data.data ?? [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Timetable Management" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Timetable' }]} />
      {loading ? <LoadingSpinner className="mx-auto mt-16" /> : timetables.length === 0 ? (
        <div className="text-center py-16"><Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No timetables configured yet</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {timetables.map(t => (
            <Card key={t.id}>
              <CardHeader><CardTitle className="text-base">{t.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.class?.name} · {t.academicYear?.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{t.slots.length} slots</span>
                  <Badge variant={t.isActive ? 'success' : 'secondary'}>{t.isActive ? 'Active' : 'Draft'}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
