import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  profileSchema,
  signupSchema,
} from '@/lib/auth/validation';

describe('signupSchema', () => {
  it('accepts a valid signup and lowercases the email', () => {
    const parsed = signupSchema.parse({
      email: '  Fan@Example.COM ',
      password: 'hunter2hunter2',
      displayName: '  Roster Guru ',
    });
    expect(parsed.email).toBe('fan@example.com');
    expect(parsed.displayName).toBe('Roster Guru');
  });

  it('allows omitting displayName', () => {
    expect(
      signupSchema.safeParse({ email: 'a@b.co', password: 'longenough' })
        .success
    ).toBe(true);
  });

  it('rejects short passwords', () => {
    expect(
      signupSchema.safeParse({ email: 'a@b.co', password: 'short' }).success
    ).toBe(false);
  });

  it('rejects passwords beyond the 72-byte bcrypt limit', () => {
    expect(
      signupSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(73) })
        .success
    ).toBe(false);
  });

  it('rejects invalid emails', () => {
    expect(
      signupSchema.safeParse({ email: 'not-an-email', password: 'longenough' })
        .success
    ).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts email + password', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.co', password: 'anything' }).success
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(
      false
    );
  });
});

describe('profileSchema', () => {
  const valid = {
    sleeperUsername: 'mstaubach',
    sleeperUserId: '123456789',
    leagues: [
      { leagueId: '111', name: 'Dynasty League' },
      { leagueId: '222', name: 'Second League' },
    ],
    primaryLeagueId: '111',
  };

  it('accepts a valid profile', () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a primary league that is not in the saved leagues', () => {
    expect(
      profileSchema.safeParse({ ...valid, primaryLeagueId: '999' }).success
    ).toBe(false);
  });

  it('rejects non-numeric league ids', () => {
    expect(
      profileSchema.safeParse({
        ...valid,
        leagues: [{ leagueId: 'abc', name: 'Bad' }],
        primaryLeagueId: 'abc',
      }).success
    ).toBe(false);
  });

  it('rejects an empty league list', () => {
    expect(
      profileSchema.safeParse({ ...valid, leagues: [] }).success
    ).toBe(false);
  });
});
