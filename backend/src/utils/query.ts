import { ParsedQs } from 'qs';

/**
 * Extract a single string from a query param (which Express types as string | string[] | ParsedQs).
 */
export function qs(value: string | string[] | ParsedQs | ParsedQs[] | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value[0] as string | undefined;
  if (typeof value === 'string') return value;
  return undefined;
}
