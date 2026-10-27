import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

export type SessionPayload = {
  userId: string | number;
  email: string;
  role: 'master_admin' | 'client';
  nome: string;
  clientId?: string | number;
  slug?: string;
  uuid_antigo?: string;
};

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'painel-ia-jwt-secret-key-32-chars-long!!'
);

const COOKIE_NAME = 'painel_session';
const DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 dias

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch (err) {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export function setSessionCookie(token: string, response?: NextResponse) {
  const cookieOptions = {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DURATION_SECONDS,
  };

  if (response) {
    response.cookies.set(cookieOptions);
  } else {
    try {
      const cookieStore = cookies();
      cookieStore.set(cookieOptions);
    } catch {
      // In some Next.js contexts, setting directly on cookies() is read-only
    }
  }
}

export function clearSessionCookie(response?: NextResponse) {
  const cookieOptions = {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };

  if (response) {
    response.cookies.set(cookieOptions);
  } else {
    try {
      const cookieStore = cookies();
      cookieStore.set(cookieOptions);
    } catch {
      // ignore
    }
  }
}
