import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock the API client so the auth screens never hit the network.
vi.mock('../api/client.js', () => {
  const api = { get: vi.fn(), post: vi.fn() };
  return {
    default: api,
    tokenStore: {
      getAccess: vi.fn(() => null),
      getRefresh: vi.fn(() => null),
      set: vi.fn(),
      clear: vi.fn(),
    },
    apiError: (e) => e?.response?.data?.error || e?.message || 'error',
  };
});

import api from '../api/client.js';
import AuthPage from './AuthPage.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { I18nProvider } from '../i18n/index.jsx';

function renderAuth(initialTab = 'login') {
  return render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthPage initialTab={initialTab} />
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthPage', () => {
  it('shows the brand and the login tab by default', () => {
    renderAuth();
    expect(screen.getByText('Домашня кухня твого району')).toBeInTheDocument();
    expect(screen.getByText('Email або телефон')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Увійти' })).toBeInTheDocument();
  });

  it('switches to the register tab and shows role options', async () => {
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole('button', { name: 'Реєстрація' }));

    expect(screen.getByText('Хто ти?')).toBeInTheDocument();
    expect(screen.getByText('Покупець')).toBeInTheDocument();
    expect(screen.getByText('Кухар')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Створити акаунт' })).toBeInTheDocument();
  });

  it('submits the login form with the entered credentials', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: {
        user: { id: '1', fullName: 'Андрій', role: 'CUSTOMER' },
        accessToken: 'a',
        refreshToken: 'r',
      },
    });

    renderAuth();
    await user.type(screen.getByPlaceholderText('you@example.com'), 'andrii@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Увійти' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        identifier: 'andrii@example.com',
        password: 'password123',
      });
    });
  });

  it('shows a server error when login fails', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue({ response: { data: { error: 'Невірний пароль' } } });

    renderAuth();
    await user.type(screen.getByPlaceholderText('you@example.com'), 'x@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(await screen.findByText('Невірний пароль')).toBeInTheDocument();
  });

  it('registers with the selected COOK role', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: {
        user: { id: '2', fullName: 'Оксана', role: 'COOK' },
        accessToken: 'a',
        refreshToken: 'r',
      },
    });

    renderAuth('register');
    await user.click(screen.getByText('Кухар'));
    await user.type(screen.getByPlaceholderText('Андрій'), 'Оксана');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'oksana@example.com');
    await user.type(screen.getByPlaceholderText('Мінімум 8 символів'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Створити акаунт' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({ role: 'COOK', email: 'oksana@example.com' })
      );
    });
  });

  it('switches the interface language to English', async () => {
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole('button', { name: 'ENG' }));
    expect(
      screen.getByText('Home cooking from your neighbourhood')
    ).toBeInTheDocument();
  });
});
