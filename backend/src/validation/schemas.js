import { z } from 'zod';

// Only CUSTOMER, COOK and COURIER can self-register; ADMIN is assigned manually.
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
    role: z.enum(['CUSTOMER', 'COOK', 'COURIER']).default('CUSTOMER'),
    // Optional cook-onboarding fields, applied only when role === 'COOK'.
    // Kept optional so a cook profile can be completed progressively; the
    // dedicated cook form collects them up front, and phone presence is
    // enforced at the phone-verification step.
    displayName: z.string().trim().min(2).max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    kitchenAddress: z.string().trim().min(3).max(200).optional(),
    deliveryZone: z.string().trim().max(200).optional(),
    // Optional courier field, applied only when role === 'COURIER'.
    transport: z.enum(['WALKING', 'BICYCLE', 'MOTORBIKE', 'CAR']).optional(),
  })
  .strict();

// Courier: toggle availability and choose transport.
export const courierStatusSchema = z.object({
  status: z.enum(['ONLINE', 'OFFLINE']).optional(),
  transport: z.enum(['WALKING', 'BICYCLE', 'MOTORBIKE', 'CAR']).optional(),
});

// Courier-driven delivery transitions.
export const courierAdvanceSchema = z.object({
  status: z.enum(['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']),
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
}).strict();

export const createAddressSchema = z.object({
  city: z.string().trim().min(1, 'Вкажіть місто'),
  street: z.string().trim().min(1, 'Вкажіть вулицю'),
  building: z.string().trim().min(1, 'Вкажіть будинок'),
  apartment: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  isDefault: z.boolean().optional().default(false),
}).strict();

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
  .strict()
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
  .strict()
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
}).strict();

export const updateDishSchema = z
  .object(dishOptional)
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Немає полів для оновлення' });

// --- Phase 3.3: orders & dashboard ------------------------------------------

export const ORDER_STATUSES = [
  'AWAITING_PAYMENT',
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COURIER_ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
  'DELIVERED',
  'CANCELLED',
];

// Checkout from the cart. Address comes from a saved address or free text.
// scheduledFor is an ISO datetime slot (omit for "as soon as possible").
export const createOrderSchema = z.object({
  addressId: z.string().trim().uuid('Некоректна адреса').optional(),
  addressText: z.string().trim().max(300).optional(),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  scheduledFor: z.string().datetime({ message: 'Некоректний час доставки' }).optional(),
  deliveryMethod: z.enum(['PICKUP', 'COOK_DELIVERY', 'COURIER']).default('COURIER'),
}).strict();

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const listOrdersSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// --- Phase 5: reviews & ratings ---------------------------------------------

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Оцінка від 1 до 5').max(5, 'Оцінка від 1 до 5'),
  comment: z
    .string()
    .trim()
    .max(1000, 'Коментар задовгий')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // NB: not .strict() — the multipart edit form also carries `keepPhotos`,
  // which the controller reads separately from this schema.
});

export const listReviewsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const reviewReplySchema = z.object({
  reply: z.string().trim().min(1, 'Відповідь не може бути порожньою').max(1000, 'Відповідь задовга'),
});


// --- Phase 6.1: in-app chat -------------------------------------------------
export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, 'Повідомлення порожнє').max(2000, 'Повідомлення задовге'),
});

export const listMessagesSchema = z.object({
  cursor: z.string().optional(), // ISO date of the oldest loaded message
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

// --- Phase 6.3: notifications -----------------------------------------------
export const listNotificationsSchema = z.object({
  cursor: z.string().optional(), // ISO date of the oldest loaded notification
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// --- Phase 7.1: admin moderation --------------------------------------------
export const listUsersSchema = z.object({
  q: z.string().trim().optional(), // name / email search
  role: z.enum(['CUSTOMER', 'COOK', 'COURIER', 'ADMIN']).optional(),
  blocked: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listAdminCooksSchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(), // verificationStatus
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const blockUserSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

// Manual refund queue: payments owed back to a buyer after a cancellation.
export const listRefundsSchema = z.object({
  status: z.enum(['REFUND_PENDING', 'REFUNDED']).default('REFUND_PENDING'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Dev-only stub payment. Declared so the two clients cannot drift apart: the
// web sent `result`, the mobile app sent `status`, and the controller read
// `result` — so asking for a failure from mobile silently succeeded.
export const mockPaymentSchema = z
  .object({
    result: z.enum(['success', 'failure']),
  })
  .strict();

export const completeRefundSchema = z
  .object({
    // Free-text reference for the transfer the admin actually made (bank
    // receipt, ticket id) — kept so a settled refund can be traced later.
    note: z.string().trim().max(300).optional(),
  })
  .strict();

// --- Phase 7.2: admin analytics ---------------------------------------------
export const analyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).optional(),
  dateFrom: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  dateTo: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

// --- Phase 8.5: background courier location reporting ------------------------
// A background task delivers positions in bursts, so the endpoint takes a
// batch. `at` is optional because some platforms report without a timestamp.
export const courierLocationSchema = z
  .object({
    orderId: z.string().trim().uuid('Некоректне замовлення'),
    positions: z
      .array(
        z
          .object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
            at: z.string().datetime().optional(),
          })
          .strict(),
      )
      .min(1, 'Порожній список координат')
      .max(50),
  })
  .strict();

// --- Phase 8.7: push device registration -------------------------------------
export const deviceTokenSchema = z
  .object({
    token: z.string().trim().min(10, 'Некоректний push-токен').max(255),
    platform: z.enum(['ios', 'android']),
  })
  .strict();

export const deviceUnregisterSchema = z
  .object({ token: z.string().trim().min(10).max(255) })
  .strict();
