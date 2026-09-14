import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('application bootstrap', () => {
  it('creates an Express application', () => {
    expect(typeof createApp().listen).toBe('function');
  });
});
