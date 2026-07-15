import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { createAddressSchema, updateAddressSchema } from '../validation/schemas.js';

// Fetches an address and asserts it belongs to the current user.
async function ownedAddress(id, userId) {
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== userId) {
    throw httpError(404, 'Адресу не знайдено');
  }
  return address;
}

// GET /api/users/addresses  (protected)
export async function listAddresses(req, res, next) {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/addresses  (protected)
export async function createAddress(req, res, next) {
  try {
    const data = createAddressSchema.parse(req.body);

    const address = await prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId: req.user.id } });
      // First address is default automatically; a new explicit default unsets others.
      const isDefault = data.isDefault || count === 0;
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...data, isDefault, userId: req.user.id },
      });
    });

    res.status(201).json({ address });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/addresses/:id  (protected)
export async function updateAddress(req, res, next) {
  try {
    await ownedAddress(req.params.id, req.user.id);
    const data = updateAddressSchema.parse(req.body);

    const address = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.address.updateMany({
          where: { userId: req.user.id, isDefault: true, NOT: { id: req.params.id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id: req.params.id }, data });
    });

    res.json({ address });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/addresses/:id/default  (protected)
export async function setDefaultAddress(req, res, next) {
  try {
    await ownedAddress(req.params.id, req.user.id);

    const address = await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId: req.user.id, isDefault: true },
        data: { isDefault: false },
      });
      return tx.address.update({
        where: { id: req.params.id },
        data: { isDefault: true },
      });
    });

    res.json({ address });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/addresses/:id  (protected)
export async function deleteAddress(req, res, next) {
  try {
    const address = await ownedAddress(req.params.id, req.user.id);
    await prisma.address.delete({ where: { id: req.params.id } });

    // If we removed the default, promote the oldest remaining address.
    if (address.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
