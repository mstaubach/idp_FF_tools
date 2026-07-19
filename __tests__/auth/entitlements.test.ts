import { describe, expect, it } from 'vitest';
import {
  canAccess,
  isPlan,
  planAtLeast,
} from '@/lib/auth/entitlements';

describe('isPlan', () => {
  it('recognizes known plans', () => {
    expect(isPlan('free')).toBe(true);
    expect(isPlan('pro')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isPlan('platinum')).toBe(false);
    expect(isPlan(undefined)).toBe(false);
    expect(isPlan(1)).toBe(false);
  });
});

describe('planAtLeast', () => {
  it('orders free below pro', () => {
    expect(planAtLeast('free', 'free')).toBe(true);
    expect(planAtLeast('free', 'pro')).toBe(false);
    expect(planAtLeast('pro', 'free')).toBe(true);
    expect(planAtLeast('pro', 'pro')).toBe(true);
  });
});

describe('canAccess', () => {
  it('gives every plan the free features', () => {
    expect(canAccess('free', 'profile-sync')).toBe(true);
    expect(canAccess('pro', 'profile-sync')).toBe(true);
  });

  it('restricts premium features to pro', () => {
    expect(canAccess('free', 'premium-tools')).toBe(false);
    expect(canAccess('pro', 'premium-tools')).toBe(true);
  });
});
