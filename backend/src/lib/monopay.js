// MonoPay (monobank acquiring) client.
//
// Two modes, chosen automatically:
//   • Real   — when MONO_TOKEN is set. Creates a hosted invoice via the
//              monobank Merchant API and verifies webhook signatures against
//              the merchant's public key.
//   • Stub   — when MONO_TOKEN is empty. Returns a local "payment page"
//              (frontend /pay/:orderId) so the whole flow is testable end to
//              end without a real acquiring contract. No signatures involved;
//              completion is driven by the dev-only mock endpoint.
//
// SECURITY: MONO_TOKEN is a secret. It is read from the environment only and
// is NEVER logged or returned to any client.

import crypto from 'node:crypto';

const API_BASE = process.env.MONO_API_BASE || 'https://api.monobank.ua';
const CURRENCY_UAH = 980; // ISO 4217

function token() {
  return process.env.MONO_TOKEN || '';
}

export function isStub() {
  return !token();
}

// Public origins used to build redirect / webhook URLs.
function appUrl() {
  const cors = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
  return process.env.APP_URL || cors;
}
function apiPublicUrl() {
  return process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
}

// Map a MonoPay invoice status to our PaymentStatus + whether the order is paid.
// MonoPay statuses: created, processing, hold, success, failure, reversed, expired.
export function mapInvoiceStatus(status) {
  switch (status) {
    case 'success':
      return { payment: 'SUCCESS', paid: true };
    case 'reversed':
      return { payment: 'REFUNDED', paid: false };
    case 'failure':
    case 'expired':
      return { payment: 'FAILED', paid: false };
    default: // created, processing, hold
      return { payment: 'PENDING', paid: false };
  }
}

// Create an invoice. Returns { invoiceId, pageUrl }.
export async function createInvoice({ amount, orderId, reference, destination }) {
  if (isStub()) {
    return {
      invoiceId: `stub_${crypto.randomUUID()}`,
      pageUrl: `${appUrl()}/pay/${orderId}`,
    };
  }

  const body = {
    amount: Math.round(Number(amount) * 100), // kopecks
    ccy: CURRENCY_UAH,
    merchantPaymInfo: {
      reference: reference || orderId,
      destination: destination || 'Замовлення Ohnyk',
    },
    redirectUrl: `${appUrl()}/pay/${orderId}`,
    webHookUrl: `${apiPublicUrl()}/api/payments/webhook`,
  };

  const res = await fetch(`${API_BASE}/api/merchant/invoice/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Token': token() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`MonoPay invoice create failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return { invoiceId: data.invoiceId, pageUrl: data.pageUrl };
}

// Fetch the current status of an invoice (fallback for polling if a webhook
// is missed). Returns null in stub mode.
export async function fetchInvoiceStatus(invoiceId) {
  if (isStub() || !invoiceId) return null;
  const res = await fetch(`${API_BASE}/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`, {
    headers: { 'X-Token': token() },
  });
  if (!res.ok) return null;
  return res.json();
}

// Cache the merchant public key (PEM) used to verify webhook signatures.
let cachedPubKey = null;
async function getPublicKeyPem() {
  if (isStub()) return null;
  if (cachedPubKey) return cachedPubKey;
  const res = await fetch(`${API_BASE}/api/merchant/pubkey`, { headers: { 'X-Token': token() } });
  if (!res.ok) throw new Error(`MonoPay pubkey fetch failed (${res.status})`);
  const data = await res.json();
  // The API returns the PEM public key base64-encoded in `key`.
  cachedPubKey = Buffer.from(data.key, 'base64').toString('utf-8');
  return cachedPubKey;
}

// Verify a webhook's X-Sign header (base64 ECDSA-SHA256 over the raw body).
// Returns true only for an authentic monobank callback.
export async function verifyWebhook(rawBody, xSign) {
  if (!xSign || !rawBody) return false;
  const pem = await getPublicKeyPem();
  if (!pem) return false;
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(pem, Buffer.from(xSign, 'base64'));
  } catch {
    return false;
  }
}
