import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(2, 'Минимум 2 символа')
      .max(32, 'Максимум 32 символа'),
    email: z.string().email('Введите корректный email'),
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .max(64, 'Максимум 64 символа'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export const createLotSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Минимум 3 символа')
      .max(120, 'Максимум 120 символов'),
    description: z
      .string()
      .min(10, 'Минимум 10 символов')
      .max(2000, 'Максимум 2000 символов'),
    start_price: z.coerce
      .number({ invalid_type_error: 'Введите число' })
      .int('Только целые числа')
      .positive('Цена должна быть положительной'),
    min_step: z.coerce
      .number({ invalid_type_error: 'Введите число' })
      .int('Только целые числа')
      .positive('Шаг должен быть положительным'),
    // start_time / end_time are optional for drafts; validated at publish time.
    start_time: z.string().optional().or(z.literal('')),
    end_time: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      // Only enforce time constraints when both fields are filled.
      if (!data.start_time || !data.end_time) return true;
      return new Date(data.end_time) > new Date(data.start_time);
    },
    { message: 'Окончание должно быть позже начала', path: ['end_time'] },
  );

export type CreateLotValues = z.infer<typeof createLotSchema>;
