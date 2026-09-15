import { describe, expect, it } from 'vitest';
import { isPublicPath, normalizePath, seoPages } from './seo';

describe('SEO route policy', () => {
  it('has unique metadata for exactly the public marketing routes', () => {
    expect(seoPages.map((page) => page.path)).toEqual(['/', '/online-zapis', '/zapis-cherez-telegram']);
    expect(new Set(seoPages.map((page) => page.title)).size).toBe(seoPages.length);
    expect(new Set(seoPages.map((page) => page.description)).size).toBe(seoPages.length);
  });

  it('never treats private or tokenized routes as public', () => {
    expect(isPublicPath('/app')).toBe(false);
    expect(isPublicPath('/companies/company-id/dashboard')).toBe(false);
    expect(isPublicPath('/reset/token-value')).toBe(false);
  });

  it('normalizes only a trailing slash', () => {
    expect(normalizePath('/online-zapis/')).toBe('/online-zapis');
  });
});
