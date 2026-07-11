import { prisma } from '../lib/prisma.js';
import { httpError } from '../middleware/errorHandler.js';
import { createAddressSchema } from '../validation/schemas.js';

// GET /api/addresses  (protected)
export async function listAddresses(req, res, next) {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }],
    });
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
}

// POST /api/addresses  (protected)
export async function createAddress(req, res, next) {
  try {
    const data = createAddressSchema.parse(req.body);

    const address = await prisma.$transaction(async (tx) => {
      // A new default address unsets any previous default.
      if (data.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...data, userId: req.user.id },
      });
    });

    res.status(201).json({ address });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/addresses/:id  (protected)
export async function deleteAddress(req, res, next) {
  try {
    const address = await prisma.address.findUnique({
      where: { id: req.params.id },
    });
    if (!address || address.userId !== req.user.id) {
      throw httpError(404, 'Адресу не знайдено');
    }
    await prisma.address.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
