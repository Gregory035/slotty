import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockPageScroll } from './scroll-lock';

afterEach(() => vi.unstubAllGlobals());

describe('overlapping overlay scroll locks', () => {
  it('unlocks only after both the menu and dialog close', () => {
    const root = { style: { overflow: '' } };
    const body = { style: { overflow: 'auto' } };
    vi.stubGlobal('document', { documentElement: root, body });
    const menu = lockPageScroll();
    const dialog = lockPageScroll();
    menu();
    expect(root.style.overflow).toBe('hidden');
    expect(body.style.overflow).toBe('hidden');
    dialog();
    expect(root.style.overflow).toBe('');
    expect(body.style.overflow).toBe('auto');
  });

  it('ignores a repeated cleanup without corrupting the lock counter', () => {
    const root = { style: { overflow: 'scroll' } };
    const body = { style: { overflow: '' } };
    vi.stubGlobal('document', { documentElement: root, body });
    const close = lockPageScroll();
    close(); close();
    const another = lockPageScroll();
    expect(root.style.overflow).toBe('hidden');
    another();
    expect(root.style.overflow).toBe('scroll');
  });

  it('preserves a pre-existing external scroll lock', () => {
    const root = { style: { overflow: 'hidden' } };
    const body = { style: { overflow: 'hidden' } };
    vi.stubGlobal('document', { documentElement: root, body });
    const close = lockPageScroll(); close();
    expect(root.style.overflow).toBe('hidden');
  });
});
