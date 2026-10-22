import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[ERROR]', err?.message || err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Prisma known errors
  if (err?.code === 'P2002') {
    res.status(409).json({ success: false, error: 'A record with that value already exists.', code: 'DUPLICATE' });
    return;
  }
  if (err?.code === 'P2025') {
    res.status(404).json({ success: false, error: 'Record not found.', code: 'NOT_FOUND' });
    return;
  }

  // Zod validation errors
  if (err?.name === 'ZodError') {
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      details: err.errors,
    });
    return;
  }

  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    success: false,
    error: isDev ? (err?.message || 'Internal server error') : 'Internal server error',
    ...(isDev && { stack: err?.stack }),
  });
}
