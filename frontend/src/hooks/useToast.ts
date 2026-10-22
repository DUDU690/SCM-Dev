import { useAppDispatch } from '@/store/hooks';
import { addToast } from '@/store/slices/notificationSlice';

export function useToast() {
  const dispatch = useAppDispatch();

  return {
    toast: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' | 'success' }) => {
      dispatch(addToast({ variant: 'default', ...opts }));
    },
    success: (title: string, description?: string) => {
      dispatch(addToast({ title, description, variant: 'success' }));
    },
    error: (title: string, description?: string) => {
      dispatch(addToast({ title, description, variant: 'destructive' }));
    },
  };
}
