import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthUser } from '../middlewares/auth.middleware';

const REFRESH_DAYS = 7;

function getAccessSecret() {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set');
  return s;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(user: AuthUser): string {
  const expires = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getAccessSecret(),
    { expiresIn: expires } as jwt.SignOptions,
  );
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);

  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const authUser: AuthUser = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(authUser);
  const refreshToken = await generateRefreshToken(user.id);

  return { accessToken, refreshToken, user: authUser };
}

export async function refreshAccessToken(token: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 401);
  }

  const authUser: AuthUser = { id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(authUser);
  return { accessToken, user: authUser };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw new AppError('Current password is incorrect', 400, 'WRONG_PASSWORD');

  const hash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  await logoutAll(userId);
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
      student: {
        select: {
          id: true, firstName: true, lastName: true, admissionNumber: true, photoUrl: true,
        },
      },
      faculty: {
        select: {
          id: true, firstName: true, lastName: true, employeeId: true, photoUrl: true, designation: true,
        },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);
  return user;
}
