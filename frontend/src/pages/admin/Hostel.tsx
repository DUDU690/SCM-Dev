import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Building2 } from 'lucide-react';

interface Hostel { id: string; name: string; description?: string; gender?: string; blocks: { id: string; name: string; rooms: { id: string; roomNumber: string; capacity: number; allocations: { id: string }[] }[] }[] }

export default function HostelPage() {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/hostel').then(r => setHostels(r.data.data ?? [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Hostel Management" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Hostel' }]} />
      {loading ? <LoadingSpinner className="mx-auto mt-16" /> : hostels.length === 0 ? (
        <div className="text-center py-16"><Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No hostels configured yet</p></div>
      ) : (
        <div className="space-y-6">
          {hostels.map(h => {
            const totalRooms = h.blocks.reduce((acc, b) => acc + b.rooms.length, 0);
            const totalBeds = h.blocks.reduce((acc, b) => acc + b.rooms.reduce((ra, r) => ra + r.capacity, 0), 0);
            const occupied = h.blocks.reduce((acc, b) => acc + b.rooms.reduce((ra, r) => ra + r.allocations.length, 0), 0);
            return (
              <Card key={h.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{h.name}{h.gender ? ` (${h.gender})` : ''}</span>
                    <span className="text-sm font-normal text-muted-foreground">{occupied}/{totalBeds} occupied</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center"><p className="text-2xl font-bold">{h.blocks.length}</p><p className="text-muted-foreground">Blocks</p></div>
                    <div className="text-center"><p className="text-2xl font-bold">{totalRooms}</p><p className="text-muted-foreground">Rooms</p></div>
                    <div className="text-center"><p className="text-2xl font-bold">{totalBeds - occupied}</p><p className="text-muted-foreground">Available</p></div>
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
