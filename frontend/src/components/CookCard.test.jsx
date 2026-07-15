import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

// FavoriteButton reads/writes auth; mock the context so the card is isolated.
const toggleFavorite = vi.fn(() => Promise.resolve());
let authUser = { id: 'u1', favoriteCookIds: [] };
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: authUser, toggleFavorite }),
}));

import CookCard from './CookCard.jsx';
import { I18nProvider } from '../i18n/index.jsx';

const cook = {
  id: 'cook-1',
  name: 'Оксана Ковальчук',
  bio: 'Домашній борщ',
  isVerified: true,
  rating: 4.9,
  reviewCount: 12,
  city: 'Черкаси',
  dishCount: 4,
  priceFrom: 85,
  avatar: null,
};

function renderCard(props = {}) {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <CookCard cook={cook} {...props} />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { id: 'u1', favoriteCookIds: [] };
});

describe('CookCard', () => {
  it('renders cook details', () => {
    renderCard();
    expect(screen.getByText('Оксана Ковальчук')).toBeInTheDocument();
    expect(screen.getByText('Домашній борщ')).toBeInTheDocument();
    expect(screen.getByText(/4\.9/)).toBeInTheDocument(); // rating (star is an icon)
    expect(screen.getByText('від 85₴')).toBeInTheDocument();
  });

  it('navigates to the cook profile on click', async () => {
    const user = userEvent.setup();
    renderCard();
    // The card navigation is the overlay button labelled with the cook name.
    await user.click(screen.getByRole('button', { name: 'Оксана Ковальчук' }));
    expect(navigate).toHaveBeenCalledWith('/cooks/cook-1');
  });

  it('toggles favourite without navigating', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /обране/i }));
    expect(toggleFavorite).toHaveBeenCalledWith('cook-1');
    expect(navigate).not.toHaveBeenCalled();
  });
});
