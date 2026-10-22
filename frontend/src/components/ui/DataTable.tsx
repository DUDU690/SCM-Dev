import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './Button';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RowData = Record<string, any>;

export interface Column<T extends RowData = RowData> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props<T extends RowData = RowData> {
  columns: Column<T>[];
  data: any[];
  keyField: string;
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  total?: number;
}

export default function DataTable<T extends RowData = RowData>({
  columns,
  data,
  keyField,
  isLoading,
  emptyMessage = 'No data found',
  page = 1,
  totalPages = 1,
  onPageChange,
  total,
}: Props<T>) {
  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`h-10 px-4 text-left font-medium text-muted-foreground ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center">
                  <div className="flex justify-center"><LoadingSpinner /></div>
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={String(row[keyField])}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-sm text-muted-foreground">
            {total !== undefined && `${total} total records`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
