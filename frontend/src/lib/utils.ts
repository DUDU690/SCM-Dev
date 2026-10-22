import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatCurrency(amount: number | string, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(amount));
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export function truncate(str: string, len = 50) {
  return str.length > len ? `${str.slice(0, len)}…` : str;
}
