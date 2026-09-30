import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || (
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
      ? ''
      : 'local-only-hadirku-development-secret'
  );
  if (!secret) {
    throw new Error('JWT_SECRET wajib diisi pada environment production Vercel.');
  }
  return secret;
}
const JWT_EXPIRES_IN = '7d';

export type Role = 'admin' | 'mentor' | 'trainee';

export interface UserTokenPayload {
  id: string;
  nim: string;
  name: string;
  role: Role;
  kejuruanId?: string | null;
  kejuruanName?: string | null;
  loginCode?: string;
}

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: UserTokenPayload;
}

// Sign JWT
export function generateToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Verify JWT
export function verifyToken(token: string): UserTokenPayload {
  return jwt.verify(token, getJwtSecret()) as UserTokenPayload;
}

// Compare password (supports both bcrypt hash and plain-text fallback during transition)
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    // $2y$ is a bcrypt variant commonly written by PHP and is compatible
    // with the same bcrypt digest format once normalized to $2b$.
    const compatibleHash = hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash;
    return bcrypt.compare(plain, compatibleHash);
  }
  return plain === hash;
}

// Middleware: Authenticate JWT from Authorization header
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.split(' ')[1];
  const cookieToken = req.headers.cookie
    ?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('hadirku_auth='))
    ?.slice('hadirku_auth='.length);
  const token = bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : undefined);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token otentikasi tidak ditemukan. Silakan login kembali.',
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Sesi login telah kedaluwarsa. Silakan login ulang.',
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Token otentikasi tidak valid.',
    });
  }
}

// Middleware: Check Roles (RBAC: Role-Based Access Control)
export function authorizeRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: pengguna belum diautentikasi.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak: Role '${req.user.role}' tidak memiliki izin untuk tindakan ini. Diperlukan role: [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
}
