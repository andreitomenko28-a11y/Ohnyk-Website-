import { z } from 'zod';

// Only CUSTOMER and COOK can self-register; ADMIN is assigned manually.
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Ім’я має містити щонайменше 2 символи'),
    email: z.string().trim().toLowerCase().email('Некоректний email'),
    phone: z
      .string()
      .trim()
      .min(6, 'Некоректний номер телефону')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    password: z.string().min(8, 'Пароль має містити щонайменше 8 символів'),
    role: z.enum(['CUSTOMER', 'COOK']).default('CUSTOMER'),
    // Optional cook-onboarding fields, applied only when role === 'COOK'.
    // Kept optional so a cook profile can be completed progressively; the
    // dedicated cook form collects them up front, and phone presence is
    // enforced at the phone-verification step.
    displayName: z.string().trim().min(2).max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    kitchenAddress: z.string().trim().min(3).max(200).optional(),
    deliveryZone: z.string().trim().max(200).optional(),
  });

export const loginSchema = z.object({
  // Accepts either an email or a phone number in the same field.
  identifier: z.string().trim().min(1, 'Введіть email або телефон'),
  password: z.string().min(1, 'Введіть пароль'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Відсутній refresh-токен'),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  phone: z
    .string()
    .trim()
    .min(6)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  avatar: z.string().trim().max(500_000).optional(), // URL or base64
  bio: z.string().trim().max(500).optional(),
  city: z.string().trim().min(1).optional(), // cook city
});

export const createAddressSchema = z.object({
  city: z.string().trim().min(1, 'Вкажіть місто'),
  street: z.string().trim().min(1, 'Вкажіть вулицю'),
  building: z.string().trim().min(1, 'Вкажіть будинок'),
  apartment: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  isDefault: z.boolean().optional().default(false),
});

// All fields optional for PATCH; at least one must be present.
export const updateAddressSchema = z
  .object({
    city: z.string().trim().min(1).optional(),
    street: z.string().trim().min(1).optional(),
    building: z.string().trim().min(1).optional(),
    apartment: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Немає полів для оновлення',
  });

export const passwordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некоректний email'),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().trim().min(1, 'Відсутній код скидання'),
  password: z.string().min(8, 'Пароль має містити щонайменше 8 символів'),
});

// --- Discovery / Search ------------------------------------------------------

// Coerce query-string params (all strings) to the right types.
export const listCooksSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const searchCooksSchema = z.object({
  q: z.string().trim().default(''),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const filterCooksSchema = z.object({
  category: z.string().trim().optional(), // category slug
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  city: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listDishesSchema = z.object({
  category: z.string().trim().optional(), // category slug
  available: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// --- Cart --------------------------------------------------------------------

export const addToCartSchema = z.object({
  dishId: z.string().trim().min(1, 'Відсутній ідентифікатор страви'),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

export const cartTotalSchema = z.object({
  deliveryFee: z.coerce.number().min(0).optional().default(0),
});

// --- Phase 3: cook account, verification, admin ------------------------------

// PATCH the authenticated cook's own profile. At least one field required.
export const cookProfileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    kitchenAddress: z.string().trim().min(3).max(200).optional(),
    deliveryZone: z.string().trim().max(200).optional().or(z.literal('')),
    city: z.string().trim().min(1).max(80).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Немає полів для оновлення' });

export const phoneVerifyConfirmSchema = z.object({
  code: z.string().trim().min(1, 'Введіть код підтвердження'),
});

export const adminRejectSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

// --- Phase 3.2: menu management ---------------------------------------------

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const timeString = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Час у форматі ГГ:ХХ');

// Shared dish fields — all optional (update uses these as-is; create re-requires
// name + price below).
const dishOptional = {
  name: z.string().trim().min(2, 'Назва — щонайменше 2 символи').max(120).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  price: z.coerce.number().positive('Ціна має бути більшою за 0').optional(),
  categoryId: z.string().trim().uuid('Некоректна категорія').optional().or(z.literal('')),
  isAvailable: z.coerce.boolean().optional(),
  availableDays: z.array(z.enum(DAYS)).max(7).optional(),
  availableFrom: timeString.optional().or(z.literal('')),
  availableUntil: timeString.optional().or(z.literal('')),
};

export const createDishSchema = z.object({
  ...dishOptional,
  name: z.string().trim().min(2, 'Назва — щонайменше 2 символи').max(120),
  price: z.coerce.number({ invalid_type_error: 'Вкажіть ціну' }).positive('Ціна має бути більшою за 0'),
  isAvailable: z.coerce.boolean().optional().default(true),
  availableDays: z.array(z.enum(DAYS)).max(7).optional().default([]),
});

export const updateDishSchema = z
  .object(dishOptional)
  .refine((d) => Object.keys(d).length > 0, { message: 'Немає полів для оновлення' });

// --- Phase 3.3: orders & dashboard ------------------------------------------

export const ORDER_STATUSES = ['NEW', 'PREPARING', 'READY', 'HANDED_OVER', 'COMPLETED', 'CANCELLED'];

// Checkout from the cart. Address comes from a saved address or free text.
// scheduledFor is an ISO datetime slot (omit for "as soon as possible").
export const createOrderSchema = z.object({
  addressId: z.string().trim().uuid('Некоректна адреса').optional(),
  addressText: z.string().trim().max(300).optional(),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  scheduledFor: z.string().datetime({ message: 'Некоректний час доставки' }).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const listOrdersSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

