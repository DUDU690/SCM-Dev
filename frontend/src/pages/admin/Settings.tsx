import { useEffect, useState } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Settings {
  id?: string; name: string; address?: string; phone?: string; email?: string;
  website?: string; tagline?: string; principalName?: string; establishedYear?: number; logo?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data.data ?? { name: '' })).catch(() => setSettings({ name: '' })).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.patch('/settings', settings);
      setSaved(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div>
      <PageHeader title="School Settings" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />
      <div className="max-w-2xl">
        <Card>
          <CardHeader><CardTitle>School Information</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">{error}</p>}
            {saved && <p className="text-sm text-green-600 mb-4 p-2 bg-green-50 rounded dark:bg-green-950">Settings saved!</p>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>School Name *</Label>
                <Input value={settings?.name ?? ''} onChange={e => setSettings(s => s ? { ...s, name: e.target.value } : s)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input value={settings?.phone ?? ''} onChange={e => setSettings(s => s ? { ...s, phone: e.target.value } : s)} /></div>
                <div><Label>Email</Label><Input type="email" value={settings?.email ?? ''} onChange={e => setSettings(s => s ? { ...s, email: e.target.value } : s)} /></div>
              </div>
              <div><Label>Address</Label><Input value={settings?.address ?? ''} onChange={e => setSettings(s => s ? { ...s, address: e.target.value } : s)} /></div>
              <div><Label>Website</Label><Input type="url" value={settings?.website ?? ''} onChange={e => setSettings(s => s ? { ...s, website: e.target.value } : s)} /></div>
              <div><Label>Tagline</Label><Input value={settings?.tagline ?? ''} onChange={e => setSettings(s => s ? { ...s, tagline: e.target.value } : s)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Principal Name</Label><Input value={settings?.principalName ?? ''} onChange={e => setSettings(s => s ? { ...s, principalName: e.target.value } : s)} /></div>
                <div><Label>Established Year</Label><Input type="number" min={1800} max={new Date().getFullYear()} value={settings?.establishedYear ?? ''} onChange={e => setSettings(s => s ? { ...s, establishedYear: parseInt(e.target.value) || undefined } : s)} /></div>
              </div>
              <Button type="submit" loading={saving}>Save Settings</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
