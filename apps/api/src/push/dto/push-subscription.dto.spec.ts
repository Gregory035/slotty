import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SavePushSubscriptionDto } from './push-subscription.dto';

describe('browser push subscription validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const input = {
    endpoint: 'https://web.push.apple.com/device-one',
    keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
  };
  const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: SavePushSubscriptionDto });

  it.each([null, 1_800_000_000_000])('accepts the standard expirationTime field with value %s', async (expirationTime) => {
    await expect(validate({ ...input, expirationTime })).resolves.toMatchObject(input);
  });

  it('accepts clients that omit expirationTime', async () => {
    await expect(validate(input)).resolves.toMatchObject(input);
  });

  it.each(['invalid', -1])('rejects an invalid expirationTime %s', async (expirationTime) => {
    await expect(validate({ ...input, expirationTime })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('continues rejecting unrelated fields instead of disabling whitelist validation', async () => {
    await expect(validate({ ...input, userId: 'another-user' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
