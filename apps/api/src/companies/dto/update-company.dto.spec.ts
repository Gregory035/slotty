import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCompanyDto } from './update-company.dto';

describe('optional company email', () => {
  it.each(['', '   ', null])('accepts %p as an explicit clear', async (email) => {
    const input = plainToInstance(UpdateCompanyDto, { email });
    expect(await validate(input)).toEqual([]);
    expect(input.email).toBeNull();
  });

  it('normalizes a provided address', async () => {
    const input = plainToInstance(UpdateCompanyDto, { email: ' Studio@Example.com ' });
    expect(await validate(input)).toEqual([]);
    expect(input.email).toBe('studio@example.com');
  });

  it('does not turn an omitted email into a clear', async () => {
    const input = plainToInstance(UpdateCompanyDto, { address: 'Новый адрес' });
    expect(await validate(input)).toEqual([]);
    expect(input.email).toBeUndefined();
  });

  it('still rejects invalid non-empty email', async () => {
    const input = plainToInstance(UpdateCompanyDto, { email: 'not-an-email' });
    expect((await validate(input)).some((error) => error.property === 'email')).toBe(true);
  });

  it('also accepts empty optional public address in a new company form', async () => {
    const input = plainToInstance(UpdateCompanyDto, { email: '', publicSlug: '', address: 'Новый адрес' });
    expect(await validate(input)).toEqual([]);
    expect(input.publicSlug).toBeNull();
  });

  it.each(['a', 'ab', '-abc', 'abc-'])('rejects invalid public address %p', async (publicSlug) => {
    expect((await validate(plainToInstance(UpdateCompanyDto, { publicSlug }))).some((error) => error.property === 'publicSlug')).toBe(true);
  });
});
