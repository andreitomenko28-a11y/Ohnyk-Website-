import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

const EMPTY = { items: [], itemCount: 0, subtotal: 0, cookId: null };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  // Load the cart whenever the signed-in user changes.
  const refresh = useCallback(async () => {
    if (!user) {
      setCart(EMPTY);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/cart');
      setCart(data.cart);
    } catch {
      setCart(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (dishId, quantity = 1) => {
    const { data } = await api.post('/cart/add', { dishId, quantity });
    setCart(data.cart);
    return data.cart;
  }, []);

  const updateItem = useCallback(async (itemId, quantity) => {
    const { data } = await api.patch(`/cart/${itemId}`, { quantity });
    setCart(data.cart);
    return data.cart;
  }, []);

  const removeItem = useCallback(async (itemId) => {
    const { data } = await api.delete(`/cart/${itemId}`);
    setCart(data.cart);
    return data.cart;
  }, []);

  const clear = useCallback(async () => {
    const { data } = await api.delete('/cart');
    setCart(data.cart);
    return data.cart;
  }, []);

  return (
    <CartContext.Provider
      value={{ cart, loading, refresh, add, updateItem, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
