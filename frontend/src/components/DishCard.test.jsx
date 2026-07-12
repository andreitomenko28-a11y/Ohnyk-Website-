import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const add = vi.fn(() => Promise.resolve());
const updateItem = vi.fn(() => Promise.resolve());
let cartState = { items: [] };

// Mock the cart context so we can assert the add/update calls.
vi.mock('../context/CartContext.jsx', () => ({
  useCart: () => ({ cart: cartState, add, updateItem }),
}));

import DishCard from './DishCard.jsx';
import { I18nProvider } from '../i18n/index.jsx';

const dish = {
  id: 'dish-1',
  name: 'Червоний борщ',
  description: 'Зі сметаною',
  price: 95,
  isAvailable: true,
  category: { emoji: '🥣' },
};

function renderDish() {
  return render(
    <I18nProvider>
      <DishCard dish={dish} />
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cartState = { items: [] };
});

describe('DishCard', () => {
  it('shows dish info and an add button when not in the cart', () => {
    renderDish();
    expect(screen.getByText('Червоний борщ')).toBeInTheDocument();
    expect(screen.getByText('95₴')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Додати/ })).toBeInTheDocument();
  });

  it('adds the dish to the cart on click', async () => {
    const user = userEvent.setup();
    renderDish();
    await user.click(screen.getByRole('button', { name: /Додати/ }));
    expect(add).toHaveBeenCalledWith('dish-1', 1);
  });

  it('renders a quantity stepper when already in the cart', () => {
    cartState = { items: [{ id: 'item-1', dishId: 'dish-1', quantity: 2 }] };
    renderDish();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('−')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('marks unavailable dishes', () => {
    render(
      <I18nProvider>
        <DishCard dish={{ ...dish, isAvailable: false }} />
      </I18nProvider>
    );
    expect(screen.getByText('Немає в наявності')).toBeInTheDocument();
  });
});
