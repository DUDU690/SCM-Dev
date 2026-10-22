import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { removeToast } from '@/store/slices/notificationSlice';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toaster() {
  const toasts = useAppSelector((s) => s.notifications.toasts);
  const dispatch = useAppDispatch();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg border shadow-lg bg-card text-card-foreground',
            t.variant === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
            t.variant === 'success' && 'border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100',
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="text-xs mt-0.5 opacity-80">{t.description}</p>}
          </div>
          <button
            onClick={() => dispatch(removeToast(t.id))}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
