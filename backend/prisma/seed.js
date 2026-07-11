import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Minimal seed data for local development.
async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const customer = await prisma.user.upsert({
    where: { email: 'andrii@example.com' },
    update: {},
    create: {
      email: 'andrii@example.com',
      phone: '+380671112233',
      passwordHash,
      fullName: 'Андрій',
      role: 'CUSTOMER',
      addresses: {
        create: { city: 'Черкаси', street: 'Хрещатик', building: '12', isDefault: true },
      },
    },
  });

  const cook = await prisma.user.upsert({
    where: { email: 'oksana@example.com' },
    update: {},
    create: {
      email: 'oksana@example.com',
      phone: '+380674445566',
      passwordHash,
      fullName: 'Оксана Ковальчук',
      role: 'COOK',
      cookProfile: {
        create: { bio: 'Домашній борщ та вареники', isVerified: true },
      },
    },
  });

  console.log('Seeded users:', { customer: customer.email, cook: cook.email });
  console.log('Password for both: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
