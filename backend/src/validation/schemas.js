import { z } from 'zod';

// Only CUSTOMER and COOK can self-register; ADMIN is assigned manually.
export const registerSchema = z.object({
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
  bio: z.string().trim().max(500).optional(),
});

export const createAddressSchema = z.object({
  city: z.string().trim().min(1, 'Вкажіть місто'),
  street: z.string().trim().min(1, 'Вкажіть вулицю'),
  building: z.string().trim().min(1, 'Вкажіть будинок'),
  isDefault: z.boolean().optional().default(false),
});
