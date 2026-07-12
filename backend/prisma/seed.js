import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Categories shared across cooks.
const CATEGORIES = [
  { name: 'Борщ', slug: 'borshch', emoji: '🥣' },
  { name: 'Варенички', slug: 'varenyky', emoji: '🥟' },
  { name: 'Шашлики', slug: 'shashlyk', emoji: '🍢' },
  { name: 'Салати', slug: 'salads', emoji: '🥗' },
  { name: 'Десерти', slug: 'desserts', emoji: '🍰' },
  { name: 'Випічка', slug: 'bakery', emoji: '🍞' },
];

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // --- Categories ------------------------------------------------------------
  const categories = {};
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, emoji: c.emoji },
      create: c,
    });
    categories[c.slug] = cat;
  }

  // --- Customer --------------------------------------------------------------
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

  // --- Cooks -----------------------------------------------------------------
  const cooksData = [
    {
      email: 'oksana@example.com',
      fullName: 'Оксана Ковальчук',
      phone: '+380674445566',
      cook: { bio: 'Домашній борщ та вареники', isVerified: true, rating: 4.9, reviewCount: 128, city: 'Черкаси', latitude: 49.4444, longitude: 32.0598 },
      dishes: [
        { name: 'Червоний борщ', description: 'На яловичому бульйоні, зі сметаною', price: 95, slug: 'borshch' },
        { name: 'Зелений борщ', description: 'Зі щавлем та яйцем', price: 90, slug: 'borshch' },
        { name: 'Вареники з картоплею', description: '10 шт, зі смаженою цибулею', price: 85, slug: 'varenyky' },
        { name: 'Вареники з вишнею', description: '10 шт, зі сметаною', price: 95, slug: 'varenyky' },
      ],
    },
    {
      email: 'hryts@example.com',
      fullName: 'Дядько Гриць',
      phone: '+380675556677',
      cook: { bio: 'Шашлики на замовлення', isVerified: true, rating: 4.8, reviewCount: 76, city: 'Черкаси', latitude: 49.4285, longitude: 32.0621 },
      dishes: [
        { name: 'Шашлик зі свинини', description: '300 г, з маринованою цибулею', price: 180, slug: 'shashlyk' },
        { name: 'Шашлик з курки', description: '300 г, у соєвому маринаді', price: 150, slug: 'shashlyk' },
        { name: 'Овочі гриль', description: 'Перець, кабачок, баклажан', price: 90, slug: 'salads' },
      ],
    },
    {
      email: 'tanya@example.com',
      fullName: 'Солодко у Тані',
      phone: '+380676667788',
      cook: { bio: 'Торти та десерти на замовлення', isVerified: true, rating: 5.0, reviewCount: 54, city: 'Черкаси', latitude: 49.4501, longitude: 32.0489 },
      dishes: [
        { name: 'Наполеон', description: 'Класичний, 1 кг', price: 350, slug: 'desserts' },
        { name: 'Медовик', description: 'Зі сметанним кремом, 1 кг', price: 320, slug: 'desserts' },
        { name: 'Чізкейк', description: 'Нью-Йорк, 8 шматочків', price: 280, slug: 'desserts' },
      ],
    },
    {
      email: 'lyuba@example.com',
      fullName: 'Пекарня Люби',
      phone: '+380677778899',
      cook: { bio: 'Пампушки та хліб на заквасці', isVerified: false, rating: 4.7, reviewCount: 41, city: 'Черкаси', latitude: 49.4390, longitude: 32.0700 },
      dishes: [
        { name: 'Хліб на заквасці', description: 'Пшенично-житній, 700 г', price: 75, slug: 'bakery' },
        { name: 'Пампушки з часником', description: '6 шт, до борщу', price: 45, slug: 'bakery' },
        { name: 'Синнабони', description: '4 шт, з корицею', price: 120, slug: 'desserts' },
      ],
    },
  ];

  const summary = [];
  for (const data of cooksData) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: { fullName: data.fullName, phone: data.phone },
      create: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        fullName: data.fullName,
        role: 'COOK',
        cookProfile: { create: data.cook },
      },
      include: { cookProfile: true },
    });

    // Refresh cook stats even for users that pre-existed (idempotent seed).
    await prisma.cook.upsert({
      where: { userId: user.id },
      update: data.cook,
      create: { userId: user.id, ...data.cook },
    });
    if (!user.cookProfile) {
      user.cookProfile = await prisma.cook.findUnique({ where: { userId: user.id } });
    }

    // Refresh dishes for this cook (idempotent seed).
    await prisma.dish.deleteMany({ where: { cookId: user.cookProfile.id } });
    for (const d of data.dishes) {
      await prisma.dish.create({
        data: {
          cookId: user.cookProfile.id,
          name: d.name,
          description: d.description,
          price: d.price,
          categoryId: categories[d.slug]?.id ?? null,
        },
      });
    }
    summary.push(`${data.fullName} (${data.dishes.length} страв)`);
  }

  console.log('Seeded categories:', Object.keys(categories).length);
  console.log('Seeded customer:', customer.email);
  console.log('Seeded cooks:', summary.join(', '));
  console.log('Password for everyone: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
