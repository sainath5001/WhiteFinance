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

export const quoteSchema = z.object({
  intentId: z.string().regex(/^\d+$/),
  payer: addressSchema.optional().nullable(),
});

export const authorizationSchema = z.object({
  from: addressSchema,
  to: addressSchema,
  value: z.string().regex(/^\d+$/),
  validAfter: z.string().regex(/^\d+$/),
  validBefore: z.string().regex(/^\d+$/),
  nonce: hexSchema.refine((v) => v.length === 66, "nonce must be bytes32"),
  signature: hexSchema.refine((v) => v.length === 132, "signature must be 65 bytes"),
});

export const submitSchema = z.object({
  intentId: z.string().regex(/^\d+$/),
  authorization: authorizationSchema,
  idempotencyKey: z.string().min(1).max(128).optional(),
});
