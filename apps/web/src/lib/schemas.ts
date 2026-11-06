import { z } from "zod";
import { getAddress, isAddress, isHex } from "viem";

export const addressSchema = z
  .string()
  .refine((v) => isAddress(v), "Invalid address")
  .transform((v) => getAddress(v));

export const hexSchema = z
  .string()
  .refine((v) => isHex(v), "Invalid hex")
  .transform((v) => v as `0x${string}`);

export const amountBaseSchema = z
  .string()
  .regex(/^\d+$/, "amountBase must be an integer string")
  .refine((v) => BigInt(v) > 0n, "amountBase must be > 0");

export const registerPreparedSchema = z.object({
  displayName: z.string().min(1).max(64),
  roles: z.number().int().min(1).max(15),
  payoutAddress: addressSchema.nullable().optional(),
  webhookUrl: z.string().max(256).optional().default(""),
});

export const createIntentPreparedSchema = z.object({
  merchant: addressSchema,
  orderRef: z.string().min(1).max(64),
  amountBase: amountBaseSchema,
  payer: addressSchema.nullable().optional(),
  expiresInSeconds: z.number().int().min(60).max(7 * 24 * 3600).default(1800),
});

export const refundPreparedSchema = z.object({
  amountBase: amountBaseSchema,
});

export const createInvoicePreparedSchema = z.object({
  seller: addressSchema,
  buyer: addressSchema,
  invoiceNumber: z.string().min(1).max(64),
  faceValueBase: amountBaseSchema,
  dueDate: z.number().int().positive(),
  documentHash: hexSchema,
  termsHash: hexSchema.optional(),
});

export const sellerRequestPreparedSchema = z.object({
  invoiceId: z.string().regex(/^\d+$/),
  advanceAmount: amountBaseSchema,
  discountAmount: z.string().regex(/^\d+$/),
  fundingDeadline: z.number().int().positive(),
});

export const buyerRequestPreparedSchema = z.object({
  invoiceId: z.string().regex(/^\d+$/),
  principal: amountBaseSchema,
  fee: z.string().regex(/^\d+$/),
  fundingDeadline: z.number().int().positive(),
});

export const idOnlySchema = z.object({
  id: z.string().regex(/^\d+$/),
});

export const verifyPaymentSchema = z.object({
  txHash: hexSchema,
  intentId: z.string().regex(/^\d+$/),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  fromBlock: z.string().regex(/^\d+$/).optional(),
});

export const merchantQuerySchema = listQuerySchema.extend({
  merchant: addressSchema,
});

export const sellerQuerySchema = listQuerySchema.extend({
  seller: addressSchema.optional(),
  buyer: addressSchema.optional(),
});

export const investorQuerySchema = listQuerySchema.extend({
  investor: addressSchema,
});
