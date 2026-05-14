import { z } from 'zod';

export const MAX_PREPAID_ESCROW_ENTRIES = 50;
const INTEGER_RATIO_EPSILON = 1e-4;
const MAX_DECIMAL_ROUNDING_RATIO_EPSILON = 0.05;
const DECIMAL_ROUNDING_HALF_UNIT = 0.5e-6;

const phoneRegex = /^(01[016789]-?\d{3,4}-?\d{4}|0[2-6][1-5]?-?\d{3,4}-?\d{4})$/;

function getWholeRatio(total: number, unit: number): number | null {
  if (!Number.isFinite(total) || !Number.isFinite(unit) || unit <= 0) return null;
  const count = total / unit;
  const rounded = Math.round(count);
  const roundingTolerance = Math.min(
    ((rounded + 1) * DECIMAL_ROUNDING_HALF_UNIT) / unit,
    MAX_DECIMAL_ROUNDING_RATIO_EPSILON,
  );
  const tolerance = Math.max(INTEGER_RATIO_EPSILON, roundingTolerance);
  return Math.abs(count - rounded) <= tolerance ? rounded : null;
}

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
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
      const entryCount = data.unitPrice !== undefined ? getWholeRatio(data.totalAmount, data.unitPrice) : null;
      if (data.unitPrice !== undefined && entryCount === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitPrice'], message: 'Total amount must be divisible by unit price' });
      }
      if (entryCount !== null && entryCount > MAX_PREPAID_ESCROW_ENTRIES) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitPrice'], message: `Prepaid escrow supports up to ${MAX_PREPAID_ESCROW_ENTRIES} entries` });
      }
    }
  });

export const finishEscrowSchema = z.object({
  entryMonth: z.number().int().min(1),
});

export const createChargeRequestSchema = z.union([
  z.object({
    menuItemId: z.string().uuid(),
  }),
  z.object({
    menuName: z.string().min(1).max(100),
    amount: z.number().positive('Amount must be positive').max(100_000_000, 'Amount exceeds maximum'),
  }),
]);

export const requestRefundReviewSchema = z.object({
  reason: z.string().trim().min(10, 'Refund reason must be at least 10 characters').max(500, 'Refund reason must be at most 500 characters'),
  photoDataUrls: z
    .array(
      z
        .string()
        .startsWith('data:image/', 'Refund review photos must be image data URLs')
        .max(2_800_000, 'Refund review photo exceeds 2MB'),
    )
    .max(3, 'Refund review supports up to 3 photos')
    .default([]),
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
  registrationNumber: z.string().transform((value) => value.replace(/\D/g, '')).pipe(z.string().regex(/^\d{10}$/, 'Business registration number must be 10 digits')),
});

export const verifyBusinessRegistrationNumberSchema = z.object({
  registrationNumber: z.string().transform((value) => value.replace(/\D/g, '')).pipe(z.string().regex(/^\d{10}$/, 'Business registration number must be 10 digits')),
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
export type RequestRefundReviewInput = z.infer<typeof requestRefundReviewSchema>;
export type CancelEscrowInput = z.infer<typeof cancelEscrowSchema>;
export type BusinessRegistrationInput = z.infer<typeof businessRegistrationSchema>;
export type VerifyBusinessRegistrationNumberInput = z.infer<typeof verifyBusinessRegistrationNumberSchema>;
export type ConsumerRegistrationInput = z.infer<typeof consumerRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
