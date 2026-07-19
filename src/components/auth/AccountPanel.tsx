'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useProfile } from '@/context/ProfileContext';
import { Profile } from '@/lib/profile/types';
import type { Plan } from '@/lib/auth/entitlements';

type Props = {
  email: string;
  displayName: string | null;
  plan: Plan;
};

const buttonClass =
  'rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50';
const secondaryButtonClass =
  'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-pitch-700 dark:text-slate-300 dark:hover:bg-pitch-800';

export default function AccountPanel({ email, displayName, plan }: Props) {
  const { profile: localProfile, setProfile } = useProfile();
  const [serverProfile, setServerProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile: Profile | null } | null) => {
        if (!cancelled) setServerProfile(data?.profile ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveToAccount = async () => {
    if (!localProfile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localProfile),
      });
      const data = (await res.json().catch(() => null)) as {
        profile?: Profile;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Could not save profile.');
      } else {
        setServerProfile(data?.profile ?? localProfile);
        setMessage('Profile saved to your account.');
      }
    } catch {
      setError('Could not save profile.');
    } finally {
      setBusy(false);
    }
  };

  const loadFromAccount = () => {
    if (!serverProfile) return;
    setProfile(serverProfile);
    setError(null);
    setMessage('Account profile loaded into this browser.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-pitch-700 dark:bg-pitch-900">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
          Account
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-28 font-medium text-gray-500 dark:text-slate-400">
              Email
            </dt>
            <dd className="text-gray-900 dark:text-slate-100">{email}</dd>
          </div>
          {displayName && (
            <div className="flex gap-2">
              <dt className="w-28 font-medium text-gray-500 dark:text-slate-400">
                Display name
              </dt>
              <dd className="text-gray-900 dark:text-slate-100">{displayName}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-28 font-medium text-gray-500 dark:text-slate-400">
              Plan
            </dt>
            <dd>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-gray-900">
                {plan}
              </span>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className={`mt-6 ${secondaryButtonClass}`}
        >
          Sign out
        </button>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-pitch-700 dark:bg-pitch-900">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
          Sleeper profile sync
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Your Sleeper username and saved leagues normally live only in this
          browser. Save them to your account to use them anywhere you sign in.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-pitch-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              This browser
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {localProfile
                ? `${localProfile.sleeperUsername} · ${localProfile.leagues.length} league${localProfile.leagues.length === 1 ? '' : 's'}`
                : 'No profile set up in this browser.'}
            </p>
            <button
              type="button"
              onClick={saveToAccount}
              disabled={busy || !localProfile}
              className={`mt-3 w-full ${buttonClass}`}
            >
              {busy ? 'Saving…' : 'Save to account'}
            </button>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 dark:border-pitch-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Your account
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {loadingProfile
                ? 'Loading…'
                : serverProfile
                  ? `${serverProfile.sleeperUsername} · ${serverProfile.leagues.length} league${serverProfile.leagues.length === 1 ? '' : 's'}`
                  : 'Nothing saved to your account yet.'}
            </p>
            <button
              type="button"
              onClick={loadFromAccount}
              disabled={busy || loadingProfile || !serverProfile}
              className={`mt-3 w-full ${secondaryButtonClass}`}
            >
              Load into this browser
            </button>
          </div>
        </div>

        {message && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-500">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </section>
    </div>
  );
}
