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

beforeEach(() => localStorage.clear());

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

  it('setActiveLeagueId updates session league without persisting', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEST_PROFILE));
    wrap((ctx) => ctx.setActiveLeagueId('xyz'));
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/abc')
    );
    act(() => screen.getByRole('button').click());
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('mstaubach/xyz')
    );
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).primaryLeagueId
    ).toBe('abc');
  });
});
