import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

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

describe('CookCard', () => {
  it('renders cook details', () => {
    renderCard();
    expect(screen.getByText('Оксана Ковальчук')).toBeInTheDocument();
    expect(screen.getByText('Домашній борщ')).toBeInTheDocument();
    expect(screen.getByText('★ 4.9')).toBeInTheDocument();
    expect(screen.getByText('від 85₴')).toBeInTheDocument();
  });

  it('navigates to the cook profile on click', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText('Оксана Ковальчук'));
    expect(navigate).toHaveBeenCalledWith('/cooks/cook-1');
  });
});
