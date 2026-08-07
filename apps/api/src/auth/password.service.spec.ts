import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password', async () => {
    const hash = await service.hash('correct horse battery staple');

    expect(hash).not.toContain('correct horse battery staple');
    await expect(
      service.verify('correct horse battery staple', hash),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password and malformed hash', async () => {
    const hash = await service.hash('right-password');

    await expect(service.verify('wrong-password', hash)).resolves.toBe(false);
    await expect(service.verify('right-password', 'invalid')).resolves.toBe(false);
  });
});
