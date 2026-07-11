import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests hit a real (test) database, so run them serially.
    fileParallelism: false,
    globalSetup: './tests/globalSetup.js',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
