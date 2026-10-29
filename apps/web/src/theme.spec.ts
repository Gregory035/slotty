import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('shared visual foundations', () => {
  it('defines the palette in one place, not in workspace overrides', () => {
    expect(read('./theme.css').match(/:root\s*\{/g)).toHaveLength(1);
    expect(read('./public.css')).toContain("@import './theme.css'");
    expect(read('./styles.css')).not.toMatch(/:root\s*\{/);
  });

  it('keeps the brand accent and explicit light/dark surfaces', () => {
    const theme = read('./theme.css');
    expect(theme).toContain('--accent: #c7ff31');
    expect(theme).toContain("[data-theme='dark']");
    expect(theme.match(/--surface:/g)).toHaveLength(2);
    expect(theme).toContain('--danger-soft: var(--danger-surface)');
  });

  it('does not leak old landing rules from the private app bundle', () => {
    expect(read('./styles.css')).not.toContain('.landing-');
  });

  it('retains keyboard focus and reduced-motion support', () => {
    const css = read('./public.css');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).not.toContain('hero-glow-left');
    expect(css).not.toContain('hero-glow-right');
  });
});
