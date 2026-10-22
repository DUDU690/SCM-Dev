import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/utils';
import { Bell, CheckCheck } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { setUnreadCount } from '@/store/slices/notificationSlice';

interface Notification { id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string; link?: string }

export default function NotificationsPage() {
  const dispatch = useAppDispatch();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/notifications').then(r => {
      setNotifications(r.data.data);
      const unread = r.data.data.filter((n: Notification) => !n.isRead).length;
      dispatch(setUnreadCount(unread));
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
      dispatch(setUnreadCount(0));
    } catch (err) { console.error(err); }
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
      const unread = notifications.filter(n => !n.isRead && n.id !== id).length;
      dispatch(setUnreadCount(unread));
    } catch (err) { console.error(err); }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notifications' }]}
        actions={unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="h-4 w-4 mr-1" />Mark all read</Button>
        ) : undefined}
      />

      {loading ? <LoadingSpinner className="mx-auto mt-16" /> : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className={!n.isRead ? 'border-primary/50 bg-primary/5' : ''} onClick={() => !n.isRead && markRead(n.id)}>
              <CardContent className="py-4 flex items-start gap-3 cursor-pointer">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.isRead ? 'bg-muted' : 'bg-primary'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${n.isRead ? '' : 'font-semibold'}`}>{n.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="info" className="text-[10px]">{n.type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(n.createdAt, 'dd MMM HH:mm')}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
