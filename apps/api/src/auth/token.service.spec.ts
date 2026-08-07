import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const service = new TokenService(
    new ConfigService({
      JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-characters',
      JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
    }),
  );

  it('signs and verifies an access token', () => {
    const token = service.signAccessToken({
      id: '1a05c70c-993a-4aee-a7aa-bfb80333403e',
      email: 'owner@example.com',
    });

    expect(service.verifyAccessToken(token)).toEqual(
      expect.objectContaining({
        sub: '1a05c70c-993a-4aee-a7aa-bfb80333403e',
        email: 'owner@example.com',
        type: 'access',
      }),
    );
  });

  it('rejects tampered access and refresh tokens', () => {
    const accessToken = service.signAccessToken({
      id: '1a05c70c-993a-4aee-a7aa-bfb80333403e',
      email: 'owner@example.com',
    });
    const refreshToken = service.createRefreshToken();

    expect(service.verifyAccessToken(`${accessToken}x`)).toBeNull();
    expect(service.verifyRefreshToken(refreshToken)).toBe(true);
    expect(service.verifyRefreshToken(`${refreshToken}x`)).toBe(false);
  });
});
