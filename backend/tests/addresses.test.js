import { describe, it, expect } from 'vitest';
import { request, registerUser } from './helpers.js';

async function authHeader() {
  const { accessToken } = await registerUser();
  return { Authorization: `Bearer ${accessToken}` };
}

describe('Addresses', () => {
  it('requires authentication (401)', async () => {
    const res = await request.get('/api/addresses');
    expect(res.status).toBe(401);
  });

  it('creates and lists an address', async () => {
    const headers = await authHeader();
    const create = await request
      .post('/api/addresses')
      .set(headers)
      .send({ city: 'Черкаси', street: 'Хрещатик', building: '12', isDefault: true });
    expect(create.status).toBe(201);
    expect(create.body.address.city).toBe('Черкаси');

    const list = await request.get('/api/addresses').set(headers);
    expect(list.status).toBe(200);
    expect(list.body.addresses).toHaveLength(1);
  });

  it('validates the payload (400)', async () => {
    const headers = await authHeader();
    const res = await request.post('/api/addresses').set(headers).send({ city: '' });
    expect(res.status).toBe(400);
  });

  it('keeps only one default address', async () => {
    const headers = await authHeader();
    await request
      .post('/api/addresses')
      .set(headers)
      .send({ city: 'A', street: 'S1', building: '1', isDefault: true });
    await request
      .post('/api/addresses')
      .set(headers)
      .send({ city: 'B', street: 'S2', building: '2', isDefault: true });

    const list = await request.get('/api/addresses').set(headers);
    const defaults = list.body.addresses.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].city).toBe('B');
  });

  it('deletes an address', async () => {
    const headers = await authHeader();
    const create = await request
      .post('/api/addresses')
      .set(headers)
      .send({ city: 'X', street: 'Y', building: 'Z' });
    const id = create.body.address.id;

    const del = await request.delete(`/api/addresses/${id}`).set(headers);
    expect(del.status).toBe(204);

    const list = await request.get('/api/addresses').set(headers);
    expect(list.body.addresses).toHaveLength(0);
  });

  it("cannot delete another user's address (404)", async () => {
    const owner = await authHeader();
    const create = await request
      .post('/api/addresses')
      .set(owner)
      .send({ city: 'X', street: 'Y', building: 'Z' });
    const id = create.body.address.id;

    const intruder = await authHeader();
    const del = await request.delete(`/api/addresses/${id}`).set(intruder);
    expect(del.status).toBe(404);
  });
});
