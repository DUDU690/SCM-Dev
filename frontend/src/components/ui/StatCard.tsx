import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
  className?: string;
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
};

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue', className }: Props) {
  return (
    <div className={cn('rounded-lg border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={cn('text-xs mt-2 font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
