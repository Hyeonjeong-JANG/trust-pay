import { z } from 'zod';

const xrplAddressRegex = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

export const xrplAddressSchema = z
  .string()
  .regex(xrplAddressRegex, 'Invalid XRPL address');

export const createEscrowSchema = z.object({
  consumerAddress: xrplAddressSchema,
  businessAddress: xrplAddressSchema,
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
  escrowId: z.string().uuid(),
  entryMonth: z.number().int().min(1),
});

export const cancelEscrowSchema = z.object({
  escrowId: z.string().uuid(),
});

export const businessRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  address: z.string().min(1).max(200),
  xrplAddress: xrplAddressSchema,
});

export type CreateEscrowInput = z.infer<typeof createEscrowSchema>;
export type FinishEscrowInput = z.infer<typeof finishEscrowSchema>;
export type CancelEscrowInput = z.infer<typeof cancelEscrowSchema>;
export type BusinessRegistrationInput = z.infer<typeof businessRegistrationSchema>;
