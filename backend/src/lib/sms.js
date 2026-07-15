// Phone verification — STUB.
//
// Real SMS delivery is not wired up yet. For now every phone "receives" the
// same fixed code and any confirmation against it succeeds. This keeps the
// cook onboarding flow testable end-to-end without a paid provider.
//
// TODO(Phase 4+): replace the two functions below with a real provider
// (Twilio Verify / Vonage / Kyivstar API). Suggested shape:
//   import twilio from 'twilio';
//   const client = twilio(env.TWILIO_SID, env.TWILIO_TOKEN);
//   sendVerificationCode: client.verify.v2.services(SID).verifications.create({ to, channel: 'sms' })
//   checkVerificationCode: client.verify.v2.services(SID).verificationChecks.create({ to, code })
// Store nothing locally once a real provider owns the code lifecycle.

export const STUB_CODE = '0000';

// Pretend to send an SMS. Returns the code only outside production so the UI/
// tests can display/use it. In production this must return no code.
export async function sendVerificationCode(phone) {
  // TODO: integrate real SMS provider here.
  console.log(`[sms:stub] verification code for ${phone} is ${STUB_CODE}`);
  return {
    sent: true,
    ...(process.env.NODE_ENV !== 'production' ? { devCode: STUB_CODE } : {}),
  };
}

// Validate a submitted code. Stub: accepts the fixed code (or empty, treated as
// auto-confirm) — never accepts arbitrary wrong codes so the UI path is real.
export async function checkVerificationCode(phone, code) {
  // TODO: verify against real provider here.
  return code === STUB_CODE;
}
