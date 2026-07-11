import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Start each test with a clean localStorage (used for tokens and language).
beforeEach(() => {
  localStorage.clear();
});
