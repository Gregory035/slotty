import { BadRequestException } from '@nestjs/common';
import { decodeUuid, encodeUuid } from './callback-data.util';

describe('Telegram callback UUID codec', () => {
  const uuid = '8d4ad235-cdb7-4df8-922d-e92e51a75d02';

  it('round-trips a UUID in 22 callback-safe characters', () => {
    const compact = encodeUuid(uuid);
    expect(compact).toHaveLength(22);
    expect(compact).not.toContain(':');
    expect(decodeUuid(compact)).toBe(uuid);
  });

  it('rejects malformed callback data', () => {
    expect(() => decodeUuid('not-a-uuid')).toThrow(BadRequestException);
  });
});
