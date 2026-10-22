import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { Check, X, Eye, Clock, BookmarkCheck, AlertCircle } from 'lucide-react';

interface Admission {
  id: string; referenceNumber: string; firstName: string; lastName: string;
  status: string; createdAt: string; reviewNotes?: string;
  class: { name: string }; academicYear: { name: string };
  guardianName: string; guardianPhone: string; guardianEmail?: string;
  email?: string; phone?: string; address?: string;
  gender?: string; dateOfBirth?: string;
}

const STATUS_COLOR: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'default'> = {
  PENDING: 'warning', UNDER_REVIEW: 'info', APPROVED: 'success',
  REJECTED: 'destructive', WAITLISTED: 'default', ENROLLED: 'success',
};

const STATUSES = ['', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED', 'ENROLLED'];

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [detail, setDetail] = useState<Admission | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admissions', { params: { page, limit: 20, status: statusFilter || undefined } })
      .then(r => { setAdmissions(r.data.data ?? []); setTotal(r.data.total); setTotalPages(r.data.totalPages); })
      .catch(console.error).finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string, notes?: string) {
    setActioning(true); setActionError('');
    try {
      await api.patch(`/admissions/${id}/review`, { status, reviewNotes: notes || undefined });
      setDetail(null);
      load();
    } catch (err: unknown) {
      setActionError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to update status'
      );
    } finally { setActioning(false); }
  }

  const columns: Column<Admission>[] = [
    { key: 'referenceNumber', header: 'Ref #' },
    { key: 'name', header: 'Applicant', render: r => `${r.firstName} ${r.lastName}` },
    { key: 'class', header: 'Applied For', render: r => `${(r.class as { name: string }).name} · ${(r.academicYear as { name: string }).name}` },
    { key: 'guardian', header: 'Guardian', render: r => r.guardianName as string },
    { key: 'createdAt', header: 'Date', render: r => formatDate(r.createdAt as string) },
    { key: 'status', header: 'Status', render: r => <Badge variant={STATUS_COLOR[r.status as string] ?? 'default'}>{(r.status as string).replace('_', ' ')}</Badge> },
    { key: 'actions', header: '', className: 'w-10', render: r => (
      <Button size="sm" variant="ghost" title="View details" onClick={() => { setDetail(r as unknown as Admission); setReviewNote((r as unknown as Admission).reviewNotes || ''); setActionError(''); }}>
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  // Which action buttons to show based on current status
  const canAction = detail && !['ENROLLED'].includes(detail.status);

  return (
    <div>
      <PageHeader
        title="Admissions"
        description={`${total} applications`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admissions' }]}
      />

      <div className="mb-4">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All Statuses'}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={admissions as unknown as Record<string, unknown>[]}
        keyField="id"
        isLoading={loading}
        emptyMessage="No applications found"
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Application — {detail.referenceNumber}</h2>
                <Badge variant={STATUS_COLOR[detail.status] ?? 'default'} className="mt-1">
                  {detail.status.replace('_', ' ')}
                </Badge>
              </div>
              <button onClick={() => setDetail(null)}><X className="h-5 w-5" /></button>
            </div>

            {/* Applicant details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 p-3 bg-muted/40 rounded-lg">
              {[
                ['Full Name', `${detail.firstName} ${detail.lastName}`],
                ['Applied For', `${detail.class.name} · ${detail.academicYear.name}`],
                ['Email', detail.email || '—'],
                ['Phone', detail.phone || '—'],
                ['Gender', detail.gender || '—'],
                ['Date of Birth', detail.dateOfBirth ? formatDate(detail.dateOfBirth) : '—'],
                ['Address', detail.address || '—'],
                ['Applied On', formatDate(detail.createdAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted-foreground text-xs">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>

            {/* Guardian */}
            <div className="text-sm mb-4 p-3 border rounded-lg">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Guardian / Parent</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  ['Name', detail.guardianName],
                  ['Phone', detail.guardianPhone],
                  ['Email', detail.guardianEmail || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-muted-foreground text-xs">{k}</p>
                    <p className="font-medium">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Review notes */}
            <div className="mb-4">
              <label className="text-sm font-medium">Review Notes</label>
              <textarea
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20"
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="Add notes visible to the applicant on status change…"
                disabled={!canAction}
              />
            </div>

            {/* Error */}
            {actionError && (
              <div className="mb-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {actionError}
              </div>
            )}

            {/* Action buttons */}
            {canAction ? (
              <div className="flex flex-wrap gap-2">
                {detail.status !== 'UNDER_REVIEW' && (
                  <Button
                    variant="outline"
                    loading={actioning}
                    onClick={() => updateStatus(detail.id, 'UNDER_REVIEW', reviewNote)}
                    className="flex-1"
                  >
                    <Clock className="h-4 w-4 mr-1" />Under Review
                  </Button>
                )}
                {detail.status !== 'APPROVED' && (
                  <Button
                    loading={actioning}
                    onClick={() => updateStatus(detail.id, 'APPROVED', reviewNote)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="h-4 w-4 mr-1" />Approve
                  </Button>
                )}
                {detail.status !== 'WAITLISTED' && (
                  <Button
                    variant="outline"
                    loading={actioning}
                    onClick={() => updateStatus(detail.id, 'WAITLISTED', reviewNote)}
                    className="flex-1"
                  >
                    <BookmarkCheck className="h-4 w-4 mr-1" />Waitlist
                  </Button>
                )}
                {detail.status !== 'REJECTED' && (
                  <Button
                    variant="destructive"
                    loading={actioning}
                    onClick={() => updateStatus(detail.id, 'REJECTED', reviewNote)}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-1" />Reject
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground py-2">
                This application is <strong>{detail.status}</strong> and cannot be changed further.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
