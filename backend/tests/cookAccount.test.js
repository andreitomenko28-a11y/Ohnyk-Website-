import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { request, registerUser, registerCook, authHeader } from './helpers.js';

describe('Cook onboarding & verification (Module 3.1)', () => {
  it('allows progressive onboarding but requires a phone before verification', async () => {
    // A cook can register without a phone (profile completed later)…
    const reg = await request.post('/api/auth/register').send({
      fullName: 'Без Телефону',
      email: `c${Date.now()}@example.com`,
      password: 'password123',
      role: 'COOK',
    });
    expect(reg.status).toBe(201);

    // …but requesting a phone code fails until a number is on file.
    const code = await request
      .post('/api/cook/verification/phone/request')
      .set(authHeader(reg.body.accessToken));
    expect(code.status).toBe(400);
  });

  it('creates a PENDING cook profile with onboarding fields', async () => {
    const { user, cook } = await registerCook({ displayName: 'Кухня Оксани' });
    expect(user.role).toBe('COOK');
    expect(cook.verificationStatus).toBe('PENDING');
    expect(cook.status).toBe('PENDING');
    expect(cook.kitchenAddress).toBe('вул. Тестова, 1, Черкаси');
    expect(cook.displayName).toBe('Кухня Оксани');
  });

  it('GET /api/cook/me reports canOperate=false before verification', async () => {
    const { accessToken } = await registerCook();
    const res = await request.get('/api/cook/me').set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.cook.canOperate).toBe(false);
    expect(res.body.cook.phoneVerified).toBe(false);
  });

  it('verifies the phone with the stub code and rejects a wrong one', async () => {
    const { accessToken } = await registerCook();

    const reqCode = await request
      .post('/api/cook/verification/phone/request')
      .set(authHeader(accessToken));
    expect(reqCode.status).toBe(200);
    expect(reqCode.body.devCode).toBe('0000');

    const wrong = await request
      .post('/api/cook/verification/phone/confirm')
      .set(authHeader(accessToken))
      .send({ code: '9999' });
    expect(wrong.status).toBe(400);

    const ok = await request
      .post('/api/cook/verification/phone/confirm')
      .set(authHeader(accessToken))
      .send({ code: '0000' });
    expect(ok.status).toBe(200);
    expect(ok.body.cook.phoneVerified).toBe(true);
  });

  it('updates the cook profile via PUT /api/cook/profile', async () => {
    const { accessToken } = await registerCook();
    const res = await request
      .put('/api/cook/profile')
      .set(authHeader(accessToken))
      .send({ bio: 'Оновлений опис', deliveryZone: 'Соснівка' });
    expect(res.status).toBe(200);
    expect(res.body.cook.bio).toBe('Оновлений опис');
    expect(res.body.cook.deliveryZone).toBe('Соснівка');
  });

  it('uploads and resizes a profile photo to webp', async () => {
    const { accessToken } = await registerCook();
    const jpeg = await sharp({
      create: { width: 900, height: 900, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      .jpeg()
      .toBuffer();

    const res = await request
      .post('/api/cook/profile/photo')
      .set(authHeader(accessToken))
      .attach('photo', jpeg, 'avatar.jpg');
    expect(res.status).toBe(201);
    expect(res.body.cook.avatar).toMatch(/^\/uploads\/cooks\/.*\.webp$/);
  });

  it('rejects a non-image uploaded as a photo', async () => {
    const { accessToken } = await registerCook();
    const res = await request
      .post('/api/cook/profile/photo')
      .set(authHeader(accessToken))
      .attach('photo', Buffer.from('%PDF-1.4 fake'), 'permit.pdf');
    expect(res.status).toBe(400);
  });

  it('blocks non-cooks from the cook account API', async () => {
    const { accessToken } = await registerUser({ role: 'CUSTOMER' });
    const res = await request.get('/api/cook/me').set(authHeader(accessToken));
    expect(res.status).toBe(403);
  });
});
