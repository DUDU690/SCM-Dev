import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Slot { id: string; dayOfWeek: string; startTime: string; endTime: string; subject: { name: string }; section: { name: string; class: { name: string } }; room?: string }

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function FacultyTimetablePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timetables/my').then(r => setSlots(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  const today = DAYS[new Date().getDay() - 1] ?? '';

  return (
    <div>
      <PageHeader title="My Timetable" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Timetable' }]} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DAYS.map(day => {
          const daySlots = slots.filter(s => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <Card key={day} className={today === day ? 'border-primary' : ''}>
              <CardHeader className="py-3">
                <CardTitle className={`text-sm ${today === day ? 'text-primary' : ''}`}>
                  {day.charAt(0) + day.slice(1).toLowerCase()}{today === day ? ' (Today)' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {daySlots.length > 0 ? daySlots.map(s => (
                  <div key={s.id} className="py-2 border-b last:border-0">
                    <p className="text-sm font-medium">{s.subject.name}</p>
                    <p className="text-xs text-muted-foreground">{s.section?.class?.name} / Sec {s.section?.name}{s.room ? ` · Room ${s.room}` : ''}</p>
                    <p className="text-xs text-primary">{s.startTime} – {s.endTime}</p>
                  </div>
                )) : <p className="text-xs text-muted-foreground text-center py-3">No classes</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
