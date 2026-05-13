import { z } from 'zod';

export const MAX_PREPAID_ESCROW_ENTRIES = 50;

const phoneRegex = /^(01[016789]-?\d{3,4}-?\d{4}|0[2-6][1-5]?-?\d{3,4}-?\d{4})$/;

export const phoneSchema = z
  .string()
  .regex(phoneRegex, 'Invalid Korean phone number');

export const emailSchema = z.string().email('Invalid email address');

export const createEscrowSchema = z
  .object({
    consumerId: z.string().uuid(),
    businessId: z.string().uuid(),
    productId: z.string().uuid().optional(),
    totalAmount: z
      .number()
      .positive('Amount must be positive')
      .max(100_000_000, 'Amount exceeds maximum'),
    months: z
      .number()
      .int()
      .min(1, 'Minimum 1 month')
      .max(24, 'Maximum 24 months')
      .optional(),
    escrowType: z.enum(['monthly', 'prepaid']).default('monthly'),
    unitPrice: z.number().positive('Unit price must be positive').optional(),
    validityMonths: z
      .number()
      .int()
      .min(1, 'Minimum 1 month')
      .max(36, 'Maximum 36 months')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.escrowType === 'monthly' && data.months === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['months'], message: 'Months is required for monthly escrow' });
    }

    if (data.escrowType === 'prepaid') {
      if (data.unitPrice === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitPrice'], message: 'Unit price is required for prepaid escrow' });
      }
      if (data.validityMonths === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validityMonths'], message: 'Validity months is required for prepaid escrow' });
      }
      if (data.unitPrice !== undefined && !Number.isInteger(data.totalAmount / data.unitPrice)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitPrice'], message: 'Total amount must be divisible by unit price' });
      }
      if (data.unitPrice !== undefined && data.totalAmount / data.unitPrice > MAX_PREPAID_ESCROW_ENTRIES) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitPrice'], message: `Prepaid escrow supports up to ${MAX_PREPAID_ESCROW_ENTRIES} entries` });
      }
    }
  });

export const finishEscrowSchema = z.object({
  entryMonth: z.number().int().min(1),
});

export const createChargeRequestSchema = z.object({
  menuItemId: z.string().uuid(),
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

const loginIdentifierSchema = z
  .object({
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    role: z.enum(['consumer', 'business']),
    name: z.string().min(1).max(100).optional(),
  })
  .refine((data) => data.phone || data.email, {
    message: 'Either phone or email is required',
  });

export const loginSchema = loginIdentifierSchema;

export const requestCodeSchema = loginIdentifierSchema;

export const verifyCodeSchema = loginIdentifierSchema.and(
  z.object({ code: z.string().regex(/^\d{6}$/, 'Invalid verification code') }),
);

export type CreateEscrowInput = z.infer<typeof createEscrowSchema>;
export type FinishEscrowInput = z.infer<typeof finishEscrowSchema>;
export type CreateChargeRequestInput = z.infer<typeof createChargeRequestSchema>;
export type CancelEscrowInput = z.infer<typeof cancelEscrowSchema>;
export type BusinessRegistrationInput = z.infer<typeof businessRegistrationSchema>;
export type ConsumerRegistrationInput = z.infer<typeof consumerRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
