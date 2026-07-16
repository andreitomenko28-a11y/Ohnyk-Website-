import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { computePricing } from '../src/lib/pricing.js';
import { recomputeCookRating } from '../src/lib/reviews.js';

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

  // Clear orders first: OrderItem → Dish is a restrict FK, so leftover orders
  // would block the per-cook dish reset below on a re-seed.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

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

  // --- Admin (verifies cooks; Phase 3 admin API) -----------------------------
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ohnyk.app' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@ohnyk.app',
      phone: '+380670000000',
      passwordHash,
      fullName: 'Адміністратор',
      role: 'ADMIN',
    },
  });

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
    include: { addresses: true },
  });

  // --- Courier (Phase 4) -----------------------------------------------------
  await prisma.user.upsert({
    where: { email: 'courier@ohnyk.app' },
    update: { role: 'COURIER' },
    create: {
      email: 'courier@ohnyk.app',
      phone: '+380679990011',
      passwordHash,
      fullName: 'Кур’єр Петро',
      role: 'COURIER',
      courierProfile: { create: { transport: 'BICYCLE', status: 'OFFLINE' } },
    },
  });

  // A verified/active cook profile (Phase 3 defaults).
  const verified = (extra) => ({
    isVerified: true,
    phoneVerified: true,
    verificationStatus: 'VERIFIED',
    status: 'ACTIVE',
    verifiedAt: new Date(),
    verifiedByAdminId: admin.id,
    ...extra,
  });

  // --- Cooks -----------------------------------------------------------------
  const cooksData = [
    {
      email: 'oksana@example.com',
      fullName: 'Оксана Ковальчук',
      phone: '+380674445566',
      cook: verified({
        displayName: 'Оксана Ковальчук',
        bio: 'Домашній борщ та вареники',
        rating: 4.9,
        reviewCount: 128,
        city: 'Черкаси',
        kitchenAddress: 'вул. Смілянська, 44, Черкаси',
        deliveryZone: 'Центр, Митниця, Соснівка',
        latitude: 49.4444,
        longitude: 32.0598,
      }),
      dishes: [
        { name: 'Червоний борщ', description: 'На яловичому бульйоні, зі сметаною', price: 95, slug: 'borshch', availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
        { name: 'Зелений борщ', description: 'Зі щавлем та яйцем', price: 90, slug: 'borshch', availableDays: ['SAT', 'SUN'] },
        { name: 'Вареники з картоплею', description: '10 шт, зі смаженою цибулею', price: 85, slug: 'varenyky' },
        { name: 'Вареники з вишнею', description: '10 шт, зі сметаною', price: 95, slug: 'varenyky' },
      ],
    },
    {
      email: 'hryts@example.com',
      fullName: 'Дядько Гриць',
      phone: '+380675556677',
      cook: verified({
        displayName: 'Шашлики від Гриця',
        bio: 'Шашлики на замовлення',
        rating: 4.8,
        reviewCount: 76,
        city: 'Черкаси',
        kitchenAddress: 'вул. Благовісна, 210, Черкаси',
        deliveryZone: 'Вся Черкаси',
        latitude: 49.4285,
        longitude: 32.0621,
      }),
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
      cook: verified({
        displayName: 'Солодко у Тані',
        bio: 'Торти та десерти на замовлення',
        rating: 5.0,
        reviewCount: 54,
        city: 'Черкаси',
        kitchenAddress: 'бул. Шевченка, 305, Черкаси',
        deliveryZone: 'Центр, придніпровський р-н',
        latitude: 49.4501,
        longitude: 32.0489,
      }),
      dishes: [
        { name: 'Наполеон', description: 'Класичний, 1 кг', price: 350, slug: 'desserts' },
        { name: 'Медовик', description: 'Зі сметанним кремом, 1 кг', price: 320, slug: 'desserts' },
        { name: 'Чізкейк', description: 'Нью-Йорк, 8 шматочків', price: 280, slug: 'desserts' },
      ],
    },
    {
      // Pending cook — not yet verified (tests the admin verify flow + guard).
      email: 'lyuba@example.com',
      fullName: 'Пекарня Люби',
      phone: '+380677778899',
      cook: {
        displayName: 'Пекарня Люби',
        bio: 'Пампушки та хліб на заквасці',
        isVerified: false,
        phoneVerified: true,
        verificationStatus: 'PENDING',
        status: 'PENDING',
        rating: 4.7,
        reviewCount: 41,
        city: 'Черкаси',
        kitchenAddress: 'вул. Гоголя, 5, Черкаси',
        deliveryZone: 'Центр',
        latitude: 49.439,
        longitude: 32.07,
      },
      dishes: [
        { name: 'Хліб на заквасці', description: 'Пшенично-житній, 700 г', price: 75, slug: 'bakery' },
        { name: 'Пампушки з часником', description: '6 шт, до борщу', price: 45, slug: 'bakery' },
        { name: 'Синнабони', description: '4 шт, з корицею', price: 120, slug: 'desserts' },
      ],
    },
  ];

  const summary = [];
  const cookDishes = {}; // email -> [{id,name,price,cookId}] for order seeding
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

    // Refresh cook profile even for users that pre-existed (idempotent seed).
    const cook = await prisma.cook.upsert({
      where: { userId: user.id },
      update: data.cook,
      create: { userId: user.id, ...data.cook },
    });

    // Refresh dishes for this cook (idempotent seed).
    await prisma.dish.deleteMany({ where: { cookId: cook.id } });
    const created = [];
    for (const d of data.dishes) {
      const dish = await prisma.dish.create({
        data: {
          cookId: cook.id,
          name: d.name,
          description: d.description,
          price: d.price,
          categoryId: categories[d.slug]?.id ?? null,
          availableDays: d.availableDays ?? [],
        },
      });
      created.push({ id: dish.id, name: dish.name, price: dish.price, cookId: cook.id });
    }
    cookDishes[data.email] = created;
    summary.push(`${data.fullName} (${data.dishes.length} страв)`);
  }

  // --- Demo orders (so the cook dashboard has data) --------------------------
  const oksanaDishes = cookDishes['oksana@example.com'];
  const oksanaCookId = oksanaDishes[0].cookId;
  const addressText = 'Черкаси, вул. Хрещатик, 12';

  // Clean previous demo orders for an idempotent seed.
  await prisma.order.deleteMany({ where: { buyerId: customer.id } });

  // The status progression each demo order has already gone through — used to
  // seed a realistic timeline (OrderEvents).
  const PROGRESSION = ['AWAITING_PAYMENT', 'NEW', 'PREPARING', 'READY', 'COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];

  // Demo orders are already paid (a successful Payment attached).
  const orderPlans = [
    { status: 'NEW', note: 'Подзвоніть перед доставкою', items: [[0, 1], [2, 2]] },
    { status: 'PREPARING', note: null, items: [[1, 1]] },
    { status: 'DELIVERED', note: 'Дякую, було смачно!', items: [[3, 1], [0, 1]] },
  ];
  let orderCount = 0;
  for (const plan of orderPlans) {
    const items = plan.items.map(([idx, qty]) => {
      const d = oksanaDishes[idx];
      return { dishId: d.id, nameSnapshot: d.name, priceSnapshot: d.price, quantity: qty };
    });
    const subtotal = items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0);
    const p = computePricing(subtotal);

    // Build the timeline up to (and including) the order's current status.
    const upto = PROGRESSION.slice(0, PROGRESSION.indexOf(plan.status) + 1);
    const base = Date.now() - upto.length * 6 * 60 * 1000; // ~6 min apart
    const events = upto.map((status, i) => ({ status, createdAt: new Date(base + i * 6 * 60 * 1000) }));

    await prisma.order.create({
      data: {
        buyerId: customer.id,
        cookId: oksanaCookId,
        status: plan.status,
        note: plan.note,
        addressText,
        subtotal: p.subtotal,
        serviceFee: p.serviceFee,
        total: p.total,
        cookPayout: p.cookPayout,
        commission: p.commission,
        items: { create: items },
        events: { create: events },
        payment: { create: { status: 'SUCCESS', amount: p.total, provider: 'monopay' } },
      },
    });
    orderCount += 1;
  }

  // --- Phase 5: demo reviews (verified purchases) ---------------------------
  const reviewData = [
    { name: 'Марія Іваненко', email: 'maria@example.com', rating: 5, comment: 'Борщ як у бабусі! Приїхало гаряченьким, дуже смачно.' },
    { name: 'Олег Петренко', email: 'oleg@example.com', rating: 5, comment: 'Найкращі вареники в Черкасах. Замовлятиму ще!' },
    { name: 'Ірина Коваль', email: 'iryna@example.com', rating: 4, comment: 'Смачно, порції великі. Доставка трохи затрималась.' },
  ];
  let reviewCount = 0;
  for (const rv of reviewData) {
    const reviewer = await prisma.user.upsert({
      where: { email: rv.email },
      update: { fullName: rv.name },
      create: { email: rv.email, passwordHash, fullName: rv.name, role: 'CUSTOMER' },
    });
    const dish = oksanaDishes[0];
    const p = computePricing(dish.price);
    const order = await prisma.order.create({
      data: {
        buyerId: reviewer.id,
        cookId: oksanaCookId,
        status: 'DELIVERED',
        addressText,
        subtotal: p.subtotal,
        serviceFee: p.serviceFee,
        total: p.total,
        cookPayout: p.cookPayout,
        commission: p.commission,
        items: { create: [{ dishId: dish.id, nameSnapshot: dish.name, priceSnapshot: dish.price, quantity: 1 }] },
        payment: { create: { status: 'SUCCESS', amount: p.total, provider: 'monopay' } },
        review: { create: { cookId: oksanaCookId, authorId: reviewer.id, rating: rv.rating, comment: rv.comment } },
      },
    });
    void order;
    reviewCount += 1;
  }
  await recomputeCookRating(oksanaCookId);

  console.log('Seeded categories:', Object.keys(categories).length);
  console.log('Seeded admin:', admin.email);
  console.log('Seeded customer:', customer.email);
  console.log('Seeded cooks:', summary.join(', '));
  console.log('Seeded demo orders for Оксана:', orderCount);
  console.log('Seeded demo reviews for Оксана:', reviewCount);
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
