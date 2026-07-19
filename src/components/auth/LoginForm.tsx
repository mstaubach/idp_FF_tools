'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }
    const callbackUrl = searchParams.get('callbackUrl');
    // Only follow same-site relative callback URLs.
    router.push(callbackUrl?.startsWith('/') ? callbackUrl : '/account');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-gray-500 dark:text-slate-400">
        No account yet?{' '}
        <Link
          href="/signup"
          className="font-medium text-green-700 hover:underline dark:text-green-500"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
