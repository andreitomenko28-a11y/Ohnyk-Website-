// Cook-area API calls, kept out of the screens so payload shaping stays
// testable and the screens stay about rendering.

import api from './client.js';
import { buildCreateDishPayload, buildUpdateDishPayload } from './dishPayload.js';
import { prepareForUpload } from './images.js';

// --- profile ---------------------------------------------------------------

export async function fetchCookProfile() {
  const { data } = await api.get('/cook/me');
  return data.cook;
}

// Server schema is .strict() and rejects an empty object, so only changed
// fields are sent (see buildCookProfilePatch).
export async function updateCookProfile(patch) {
  const { data } = await api.put('/cook/profile', patch);
  return data.cook;
}

const PROFILE_FIELDS = ['displayName', 'bio', 'kitchenAddress', 'deliveryZone', 'city'];

export function buildCookProfilePatch(form, original) {
  const patch = {};
  for (const field of PROFILE_FIELDS) {
    const next = (form[field] ?? '').trim();
    const prev = (original?.[field] ?? '').trim();
    if (next !== prev) patch[field] = next;
  }
  return patch;
}

// --- uploads ---------------------------------------------------------------

// RN's FormData takes { uri, name, type } for files; axios sets the multipart
// boundary itself, so no Content-Type header is passed here.
async function postImages(url, assets, field, baseName) {
  const form = new FormData();
  for (const [i, asset] of assets.entries()) {
    const file = await prepareForUpload(asset, assets.length > 1 ? `${baseName}-${i + 1}` : baseName);
    form.append(field, file);
  }
  const { data } = await api.post(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Uploads over mobile data are slower than plain JSON calls.
    timeout: 60000,
  });
  return data;
}

export async function uploadCookPhoto(asset) {
  const data = await postImages('/cook/profile/photo', [asset], 'photo', 'avatar');
  return data.cook;
}

export async function uploadDishPhotos(dishId, assets) {
  const data = await postImages(`/cook/dishes/${dishId}/photos`, assets, 'photos', 'dish');
  return data.dish;
}

export async function deleteDishPhoto(dishId, photoId) {
  const { data } = await api.delete(`/cook/dishes/${dishId}/photos/${photoId}`);
  return data.dish;
}

// --- dishes ----------------------------------------------------------------

export async function fetchMyDishes() {
  const { data } = await api.get('/cook/dishes');
  return data.dishes ?? [];
}

export async function createDish(form) {
  const { data } = await api.post('/cook/dishes', buildCreateDishPayload(form));
  return data.dish;
}

// Returns null when nothing changed, so callers can skip a pointless request
// that the server would reject as "no fields to update".
export async function updateDish(id, form, original) {
  const patch = buildUpdateDishPayload(form, original);
  if (Object.keys(patch).length === 0) return null;
  const { data } = await api.put(`/cook/dishes/${id}`, patch);
  return data.dish;
}

export async function deleteDish(id) {
  await api.delete(`/cook/dishes/${id}`);
}

export async function fetchCategories() {
  const { data } = await api.get('/categories');
  return data.categories ?? [];
}

// --- orders ----------------------------------------------------------------

export async function fetchCookOrders(params = {}) {
  const { data } = await api.get('/cook/orders', { params });
  return data;
}

export async function advanceOrderStatus(orderId, status) {
  const { data } = await api.patch(`/cook/orders/${orderId}/status`, { status });
  return data.order;
}

export async function fetchCookStats() {
  const { data } = await api.get('/cook/stats');
  return data;
}

// --- reviews ---------------------------------------------------------------

export async function fetchCookReviews(params = {}) {
  const { data } = await api.get('/cook/reviews', { params });
  return data; // { reviews, total, average, limit, offset }
}

export async function replyToReview(reviewId, reply) {
  const { data } = await api.post(`/cook/reviews/${reviewId}/reply`, { reply });
  return data.review;
}

// Returns 204 with no body, so there is no updated review to hand back — the
// caller clears the reply locally.
export async function deleteReviewReply(reviewId) {
  await api.delete(`/cook/reviews/${reviewId}/reply`);
}
