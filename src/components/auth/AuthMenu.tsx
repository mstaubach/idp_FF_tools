'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type SessionUser = {
  name?: string | null;
  email?: string | null;
};

/**
 * NavBar auth widget. Reads the session over HTTP instead of `auth()` so the
 * (static) layout tree stays static; re-checks on route change so signing
 * in/out is reflected without a hard reload.
 */
export default function AuthMenu() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((session: { user?: SessionUser } | null) => {
        if (!cancelled) {
          setUser(session?.user ?? null);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!loaded) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        pathname.startsWith('/account')
          ? 'bg-amber-400 text-gray-900'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-pitch-800 dark:hover:text-white'
      }`}
      title={user.email ?? undefined}
    >
      {user.name || 'Account'}
    </Link>
  );
}
