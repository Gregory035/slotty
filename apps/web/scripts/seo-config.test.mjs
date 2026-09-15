import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSeoConfiguration } from './seo-config.mjs';

test('accepts an explicit public HTTPS origin', () => {
  assert.equal(validateSeoConfiguration('https://212.74.224.226.nip.io', true), 'https://212.74.224.226.nip.io');
});

test('rejects unsafe origins for an indexable build', () => {
  for (const value of ['', 'http://slotty.ru', 'https://localhost:5173', 'https://example.com', 'https://slotty.ru/path', 'https://slotty.ru/?token=secret']) {
    assert.throws(() => validateSeoConfiguration(value, true));
  }
});

test('allows an unset origin for a noindex preview', () => {
  assert.equal(validateSeoConfiguration('', false), '');
});
