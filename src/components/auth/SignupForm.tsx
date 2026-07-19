'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-hidden dark:border-pitch-700 dark:bg-pitch-800 dark:text-slate-100 dark:placeholder:text-slate-500';

export default function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Could not create account.');
        setLoading(false);
        return;
      }
      const signInRes = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        // Account was created but auto sign-in failed; send them to login.
        router.push('/login');
        return;
      }
      router.push('/account');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="signup-name"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Display name <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="signup-email"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Email
        </label>
        <input
          id="signup-email"
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
          htmlFor="signup-password"
          className="block text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={72}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
          At least 8 characters.
        </p>
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-gray-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-green-700 hover:underline dark:text-green-500"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
