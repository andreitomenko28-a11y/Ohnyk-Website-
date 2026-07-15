import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock the API client; Discovery drives categories/cooks/search from it.
vi.mock('../api/client.js', () => {
  const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() };
  return {
    default: api,
    tokenStore: { getAccess: () => null, getRefresh: () => null, set: vi.fn(), clear: vi.fn() },
    apiError: (e) => e?.message || 'error',
  };
});

import api from '../api/client.js';
import Discovery from './Discovery.jsx';
import { I18nProvider } from '../i18n/index.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { CartProvider } from '../context/CartContext.jsx';

const categories = [{ id: 'c1', name: 'Борщ', slug: 'borshch', emoji: '🥣', dishCount: 2 }];
const cooks = [
  { id: 'k1', name: 'Оксана', bio: 'борщ', isVerified: true, rating: 4.9, reviewCount: 3, city: 'Черкаси', dishCount: 2, priceFrom: 85, avatar: null },
  { id: 'k2', name: 'Гриць', bio: 'шашлик', isVerified: false, rating: 4.7, reviewCount: 2, city: 'Черкаси', dishCount: 1, priceFrom: 150, avatar: null },
];

function mockRoutes() {
  api.get.mockImplementation((url) => {
    if (url === '/categories') return Promise.resolve({ data: { categories } });
    if (url === '/cooks') return Promise.resolve({ data: { cooks, total: 2 } });
    if (url === '/cooks/search') return Promise.resolve({ data: { cooks: [cooks[1]], total: 1 } });
    return Promise.resolve({ data: {} });
  });
}

function renderDiscovery() {
  return render(
    <I18nProvider>
      <AuthProvider>
        <CartProvider>
          <MemoryRouter>
            <Discovery />
          </MemoryRouter>
        </CartProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRoutes();
});

describe('Discovery', () => {
  it('loads and lists cooks', async () => {
    renderDiscovery();
    expect(await screen.findByText('Оксана')).toBeInTheDocument();
    expect(screen.getByText('Гриць')).toBeInTheDocument();
  });

  it('searches when typing a query', async () => {
    const user = userEvent.setup();
    renderDiscovery();
    await screen.findByText('Оксана');

    await user.type(screen.getByPlaceholderText('Борщ, варенички, кухар...'), 'Гриць');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/cooks/search', { params: { q: 'Гриць' } });
    });
  });
});
