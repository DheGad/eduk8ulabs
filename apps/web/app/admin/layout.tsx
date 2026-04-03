import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

interface JwtPayload {
  sub?: string;
  tier?: string;
  role?: string;
  exp?: number;
}

function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // In Node.js environment (Next.js Server Component), use Buffer instead of atob
    const payloadBuffer = Buffer.from(parts[1], 'base64');
    return JSON.parse(payloadBuffer.toString('utf-8')) as JwtPayload;
  } catch (err) {
    return null;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    // If somehow middleware failed, fallback to 404
    notFound();
  }

  const payload = decodeToken(token);

  // Strict RBAC Verification
  if (!payload || payload.role !== 'ADMIN') {
    // Stealth mode: we do not acknowledge this page exists to non-admins
    notFound();
  }

  return (
    <div className="admin-portal-wrapper">
      {children}
    </div>
  );
}
