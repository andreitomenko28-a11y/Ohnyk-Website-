import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { computePricing } from '../src/lib/pricing.js';
import { recomputeCookRating } from '../src/lib/reviews.js';

const prisma = new PrismaClient();

// Two-level dish taxonomy: top-level category → list of dish subcategories.
// Cooks pick a subcategory when adding a dish; buyers browse/filter by either.
const TAXONOMY = [
  { name: 'Сніданки', children: ['Омлети', 'Яєчня', 'Варені яйця', 'Каші', 'Сирники', 'Млинці', 'Оладки', 'Тости', 'Сендвічі', 'Домашня гранола'] },
  { name: 'Перші страви', children: ['Борщ', 'Капусняк', 'Розсольник', 'Солянка', 'Супи', 'Бульйони', 'Крем-супи', 'Юшка', 'Окрошка'] },
  { name: 'Основні страви', children: ['Страви з курки', 'Страви зі свинини', 'Страви з яловичини', 'Страви з індички', 'Страви з риби', 'Котлети', 'Відбивні', 'Тушковане м’ясо', 'Голубці', 'Фаршировані овочі', 'Плов', 'Печеня', 'Рагу', 'Запіканки'] },
  { name: 'Гарніри', children: ['Картопля', 'Картопляне пюре', 'Смажена картопля', 'Запечена картопля', 'Рис', 'Гречка', 'Макарони', 'Булгур', 'Кус-кус', 'Перлова каша', 'Пшоняна каша', 'Овочі на пару', 'Запечені овочі'] },
  { name: 'Салати', children: ['Овочеві', 'М’ясні', 'Рибні', 'Фруктові', 'Листові салати', 'Салати з крупами'] },
  { name: 'Закуски', children: ['Бутерброди', 'Канапки', 'Намазки', 'Паштети', 'Рулетики', 'Домашні чіпси', 'Мариновані овочі'] },
  { name: 'Випічка', children: ['Хліб', 'Булочки', 'Батони', 'Пироги', 'Пиріжки', 'Піцца', 'Лаваш', 'Фокача', 'Пампушки'] },
  { name: 'Десерти', children: ['Торти', 'Тістечка', 'Печиво', 'Кекси', 'Мафіни', 'Желе', 'Морозиво', 'Пудинги', 'Муси', 'Панакота', 'Шарлотка'] },
  { name: 'Напої', children: ['Компот', 'Узвар', 'Морс', 'Лимонад', 'Чай', 'Кава', 'Какао', 'Смузі', 'Молочні коктейлі'] },
  { name: 'Соуси', children: ['Кетчуп', 'Майонез', 'Гірчиця', 'Песто', 'Часниковий соус', 'Сирний соус', 'Томатний соус', 'Сметанний соус'] },
  { name: 'Молочні продукти', children: ['Домашній сир', 'Йогурт', 'Кефір', 'Ряжанка', 'Масло', 'Сметана', 'Вершки'] },
  { name: 'Заготовки', children: ['Варення', 'Джеми', 'Повидло', 'Консервовані овочі', 'Соління', 'Маринади', 'Заморожені овочі', 'Заморожені ягоди', 'Заморожені фрукти'] },
  { name: 'Перекуси', children: ['Горіхи', 'Сухофрукти', 'Насіння', 'Домашні батончики', 'Енергетичні кульки', 'Попкорн'] },
  { name: 'Напівфабрикати', children: ['Пельмені', 'Вареники', 'Голубці', 'Котлети', 'Фрикадельки', 'Млинці з начинкою', 'Заморожене тісто', 'Заморожена піца'] },
];

// Transliterate a Ukrainian name into a URL-safe slug.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia', "’": '', "'": '',
};
function slugify(name) {
  const base = name
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : /[a-z0-9]/.test(ch) ? ch : '-'))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'cat';
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Clear orders first: OrderItem → Dish is a restrict FK, so leftover orders
  // would block the per-cook dish reset below on a re-seed.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  // --- Categories (two-level tree) -------------------------------------------
  // Reset the whole taxonomy so re-seeds reflect the latest TAXONOMY. Dishes
  // reference categories, so clear dishes first to avoid FK conflicts.
  await prisma.dish.deleteMany();
  await prisma.category.deleteMany();

  const usedSlugs = new Set();
  const uniqueSlug = (name) => {
    let s = slugify(name);
    while (usedSlugs.has(s)) s = `${slugify(name)}-${usedSlugs.size}`;
    usedSlugs.add(s);
    return s;
  };

  const subByName = {}; // subcategory name → category record (for dish linking)
  for (let i = 0; i < TAXONOMY.length; i++) {
    const top = TAXONOMY[i];
    const parent = await prisma.category.create({
      data: { name: top.name, slug: uniqueSlug(top.name), sortOrder: i },
    });
    for (let j = 0; j < top.children.length; j++) {
      const childName = top.children[j];
      const child = await prisma.category.create({
        data: { name: childName, slug: uniqueSlug(childName), sortOrder: j, parentId: parent.id },
      });
      // First writer wins for duplicate child names (e.g. Голубці, Котлети).
      if (!subByName[childName]) subByName[childName] = child;
    }
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
        { name: 'Червоний борщ', description: 'На яловичому бульйоні, зі сметаною', price: 95, sub: 'Борщ', availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
        { name: 'Зелений борщ', description: 'Зі щавлем та яйцем', price: 90, sub: 'Борщ', availableDays: ['SAT', 'SUN'] },
        { name: 'Вареники з картоплею', description: '10 шт, зі смаженою цибулею', price: 85, sub: 'Вареники' },
        { name: 'Вареники з вишнею', description: '10 шт, зі сметаною', price: 95, sub: 'Вареники' },
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
        { name: 'Шашлик зі свинини', description: '300 г, з маринованою цибулею', price: 180, sub: 'Страви зі свинини' },
        { name: 'Шашлик з курки', description: '300 г, у соєвому маринаді', price: 150, sub: 'Страви з курки' },
        { name: 'Овочі гриль', description: 'Перець, кабачок, баклажан', price: 90, sub: 'Запечені овочі' },
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
        { name: 'Наполеон', description: 'Класичний, 1 кг', price: 350, sub: 'Торти' },
        { name: 'Медовик', description: 'Зі сметанним кремом, 1 кг', price: 320, sub: 'Торти' },
        { name: 'Чізкейк', description: 'Нью-Йорк, 8 шматочків', price: 280, sub: 'Тістечка' },
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
        { name: 'Хліб на заквасці', description: 'Пшенично-житній, 700 г', price: 75, sub: 'Хліб' },
        { name: 'Пампушки з часником', description: '6 шт, до борщу', price: 45, sub: 'Пампушки' },
        { name: 'Синнабони', description: '4 шт, з корицею', price: 120, sub: 'Булочки' },
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
          categoryId: subByName[d.sub]?.id ?? null,
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

  console.log('Seeded categories:', TAXONOMY.length, 'top-level +', Object.keys(subByName).length, 'subcategories');
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
