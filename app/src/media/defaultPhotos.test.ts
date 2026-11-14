import { afterEach, describe, expect, it, vi } from 'vitest';

describe('default photo paths', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(['/', '/nested/'])('uses the Vite base path %s', async base => {
    vi.stubEnv('BASE_URL', base);
    vi.resetModules();

    const { DEFAULT_PHOTOS } = await import('./defaultPhotos');

    expect(DEFAULT_PHOTOS[0].libraryPath).toBe(`${base}media/photos/photo-01.jpg`);
  });
});
