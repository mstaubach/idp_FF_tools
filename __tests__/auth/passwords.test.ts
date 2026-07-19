import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';

describe('passwords', () => {
  it('hashes and verifies a round trip, rejecting wrong passwords', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse');
    await expect(
      verifyPassword('correct horse battery staple', hash)
    ).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  }, 20_000);
});
