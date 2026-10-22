import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface UseApiOptions {
  enabled?: boolean;
}

export function useApi<T>(url: string, options: UseApiOptions = {}) {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      setData(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (enabled) fetch();
  }, [fetch, enabled]);

  return { data, loading, error, refetch: fetch };
}
