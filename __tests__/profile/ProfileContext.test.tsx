import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { Profile } from '@/lib/profile/types';

const STORAGE_KEY = 'idp_dynasty_profile';

const TEST_PROFILE: Profile = {
  sleeperUsername: 'mstaubach',
  sleeperUserId: '123',
  leagues: [{ leagueId: 'abc', name: 'IDP Dynasty 2025' }],
  primaryLeagueId: 'abc',
};

function Harness({
  onAction,
}: {
  onAction: (ctx: ReturnType<typeof useProfile>) => void;
}) {
  const ctx = useProfile();
  return (
    <button onClick={() => onAction(ctx)}>
      {ctx.profile?.sleeperUsername ?? 'none'}/{ctx.activeLeagueId ?? 'none'}
    </button>
  );
}

function wrap(onAction: (ctx: ReturnType<typeof useProfile>) => void) {
  return render(
    <ProfileProvider>
      <Harness onAction={onAction} />
    </ProfileProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = 'idp_active_league=; path=/; max-age=0';
});

describe('ProfileProvider', () => {
  it('starts with null profile when localStorage is empty', async () => {
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('none/none')
    );
  });

  it('hydrates from localStorage on mount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
  });

  it('setProfile updates state and localStorage', async () => {
    wrap((ctx) => ctx.setProfile(TEST_PROFILE));
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(
      TEST_PROFILE
    );
  });

  it('clearProfile resets state and removes localStorage entry', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.clearProfile());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('none/none')
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('setActiveLeagueId persists the selection and sets the cookie', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.setActiveLeagueId('xyz'));
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/xyz')
    );
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('xyz');
    expect(document.cookie).toContain('idp_active_league=xyz');
    // primary league is untouched
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).primaryLeagueId
    ).toBe('abc');
  });

  it('restores a stored active league on hydrate when it is a saved league', async () => {
    const profile: Profile = {
      ...TEST_PROFILE,
      leagues: [
        { leagueId: 'abc', name: 'IDP Dynasty 2025' },
        { leagueId: 'def', name: 'Second League' },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem('idp_dynasty_active_league', 'def');
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/def')
    );
    expect(document.cookie).toContain('idp_active_league=def');
  });

  it('falls back to the primary league when the stored active league is stale', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    localStorage.setItem('idp_dynasty_active_league', 'gone');
    wrap(() => {});
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('abc');
  });

  it('clearProfile removes the active league key and cookie', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.clearProfile());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('none/none')
    );
    expect(localStorage.getItem('idp_dynasty_active_league')).toBeNull();
    expect(document.cookie).not.toContain('idp_active_league=abc');
  });
});
