// Buyer-side API calls: discovery, cart, checkout, payment.

import api from './client.js';
import { buildCheckoutPayload } from './checkoutPayload.js';

// --- discovery --------------------------------------------------------------

export async function fetchCooks(params = {}) {
  const { data } = await api.get('/cooks', { params });
  return data; // { cooks, total, limit, offset }
}

export async function searchCooks(q, params = {}) {
  const { data } = await api.get('/cooks/search', { params: { q, ...params } });
  return data;
}

export async function fetchCookMenu(cookId) {
  const { data } = await api.get(`/cooks/${cookId}/menu`);
  return data;
}

export async function fetchCookReviewsPublic(cookId, params = {}) {
  const { data } = await api.get(`/cooks/${cookId}/reviews`, { params });
  return data;
}

// --- cart -------------------------------------------------------------------

export async function fetchCart() {
  const { data } = await api.get('/cart');
  return data.cart;
}

export async function addToCart(dishId, quantity = 1) {
  const { data } = await api.post('/cart/add', { dishId, quantity });
  return data.cart;
}

// Quantity 0 removes the line, which is how the stepper's "−" works at 1.
export async function setCartItemQuantity(itemId, quantity) {
  const { data } = await api.patch(`/cart/${itemId}`, { quantity });
  return data.cart;
}

export async function removeCartItem(itemId) {
  const { data } = await api.delete(`/cart/${itemId}`);
  return data.cart;
}

export async function clearCart() {
  const { data } = await api.delete('/cart');
  return data.cart;
}

export async function fetchCartTotal(deliveryFee = 0) {
  const { data } = await api.post('/cart/total', { deliveryFee });
  return data; // { itemCount, subtotal, serviceFee, deliveryFee, total }
}

// --- addresses --------------------------------------------------------------

export async function fetchAddresses() {
  const { data } = await api.get('/users/addresses');
  return data.addresses ?? [];
}

// --- checkout & payment -----------------------------------------------------

export async function fetchDeliverySlots() {
  const { data } = await api.get('/orders/delivery-slots');
  return data;
}

export async function createOrder(form) {
  const { data } = await api.post('/orders', buildCheckoutPayload(form));
  return data.order;
}

export async function initPayment(orderId) {
  const { data } = await api.post(`/orders/${orderId}/pay`);
  return data; // { pageUrl, invoiceId, stub }
}

export async function fetchPaymentStatus(orderId) {
  const { data } = await api.get(`/orders/${orderId}/payment`);
  return data; // { orderStatus, total, cookName, payment, stub }
}

// Dev-only: the server exposes this solely in stub mode (no MONO_TOKEN), where
// there is no real gateway to redirect to.
export async function mockCompletePayment(orderId, status = 'success') {
  const { data } = await api.post(`/orders/${orderId}/pay/mock`, { status });
  return data;
}

// --- orders -----------------------------------------------------------------

export async function fetchMyOrders(params = {}) {
  const { data } = await api.get('/orders', { params });
  return data;
}

export async function fetchOrder(orderId) {
  const { data } = await api.get(`/orders/${orderId}`);
  return data.order;
}
