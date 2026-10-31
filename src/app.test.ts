import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { env } from './shared/config/env.js';

describe('application bootstrap', () => {
  it('creates an Express application', () => {
    expect(typeof createApp().listen).toBe('function');
  });

  it('trusts the Render proxy hop only outside local development', () => {
    expect(createApp().get('trust proxy')).toBe(env.PEDILO_ENV === 'local' ? false : 1);
  });
});
