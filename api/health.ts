import { describeDatabaseConfig, pingDatabase } from '../server/db.js';

export const config = {
  maxDuration: 15,
};

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  const dbConfig = describeDatabaseConfig();
  const jwtConfigured = Boolean(process.env.JWT_SECRET);
  const requiresJwt = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  let status: 'online' | 'error' = 'online';
  let database = 'not configured';
  let error: string | undefined;

  if (requiresJwt && !jwtConfigured) {
    status = 'error';
    error = 'JWT_SECRET belum diisi di Environment Variables Vercel.';
  }

  if (!dbConfig.ok) {
    status = 'error';
    const missingMessage = `Konfigurasi database belum lengkap: ${dbConfig.missing.join(', ')}.`;
    error = error ? `${error} ${missingMessage}` : missingMessage;
  } else {
    const ping = await pingDatabase();
    if (ping.ok) {
      database = 'TiDB Cloud';
    } else {
      status = 'error';
      database = 'TiDB Cloud Error';
      const pingMessage = ping.error || 'Gagal terhubung ke TiDB.';
      error = error ? `${error} ${pingMessage}` : pingMessage;
    }
  }

  return sendJson(res, status === 'online' ? 200 : 503, {
    status,
    database,
    jwt: jwtConfigured ? 'enabled' : 'missing JWT_SECRET',
    timestamp: new Date().toISOString(),
    ...(error ? { error } : {}),
  });
}
