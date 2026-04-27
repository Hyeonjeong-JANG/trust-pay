import { z } from 'zod';

const phoneRegex = /^01[016789]-?\d{3,4}-?\d{4}$/;

export const phoneSchema = z
  .string()
  .regex(phoneRegex, 'Invalid Korean phone number');

export const emailSchema = z.string().email('Invalid email address');

export const createEscrowSchema = z.object({
  consumerId: z.string().uuid(),
  businessId: z.string().uuid(),
  totalAmount: z
    .number()
    .positive('Amount must be positive')
    .max(100_000_000, 'Amount exceeds maximum'),
  months: z
    .number()
    .int()
    .min(1, 'Minimum 1 month')
    .max(24, 'Maximum 24 months'),
});

export const finishEscrowSchema = z.object({
  entryMonth: z.number().int().min(1),
});

export const cancelEscrowSchema = z.object({
  escrowId: z.string().uuid(),
});

export const businessRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  address: z.string().min(1).max(200),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const consumerRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const loginSchema = z
  .object({
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    role: z.enum(['consumer', 'business']),
    name: z.string().min(1).max(100).optional(),
  })
  .refine((data) => data.phone || data.email, {
    message: 'Either phone or email is required',
  });

export type CreateEscrowInput = z.infer<typeof createEscrowSchema>;
export type FinishEscrowInput = z.infer<typeof finishEscrowSchema>;
export type CancelEscrowInput = z.infer<typeof cancelEscrowSchema>;
export type BusinessRegistrationInput = z.infer<typeof businessRegistrationSchema>;
export type ConsumerRegistrationInput = z.infer<typeof consumerRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
