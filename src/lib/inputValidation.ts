import { z } from "zod";

/**
 * Security: Input validation schemas for XSS prevention and data integrity
 * All text inputs are trimmed and sanitized
 */

// Max lengths for profile fields (matching database constraints)
const MAX_NAME_LENGTH = 200;
const MAX_IBAN_LENGTH = 50;
const MAX_CONTRACT_LENGTH = 50;
const MAX_NOTE_LENGTH = 1000;
const MAX_ADDRESS_LENGTH = 500;

// Helper to sanitize text (removes potential XSS vectors)
export function sanitizeText(input: string): string {
  return input
    .trim()
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove event handlers
    .replace(/\bon\w+\s*=/gi, "")
    // Remove javascript: protocol
    .replace(/javascript:/gi, "");
}

// Profile validation schema
export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Meno je povinné")
    .max(MAX_NAME_LENGTH, `Maximálne ${MAX_NAME_LENGTH} znakov`)
    .transform(sanitizeText),
  company_name: z
    .string()
    .trim()
    .max(MAX_NAME_LENGTH, `Maximálne ${MAX_NAME_LENGTH} znakov`)
    .transform(sanitizeText)
    .nullable()
    .optional(),
  contract_number: z
    .string()
    .trim()
    .max(MAX_CONTRACT_LENGTH, `Maximálne ${MAX_CONTRACT_LENGTH} znakov`)
    .transform(sanitizeText)
    .nullable()
    .optional(),
  iban: z
    .string()
    .trim()
    .max(MAX_IBAN_LENGTH, `Maximálne ${MAX_IBAN_LENGTH} znakov`)
    .regex(/^[A-Z]{2}[0-9A-Z\s]*$|^$/, "Neplatný formát IBAN")
    .transform((val) => val.replace(/\s/g, "").toUpperCase())
    .nullable()
    .optional(),
  swift_bic: z
    .string()
    .trim()
    .max(11, "SWIFT/BIC môže mať maximálne 11 znakov")
    .regex(/^[A-Z0-9]*$|^$/, "Neplatný formát SWIFT/BIC")
    .transform((val) => val.toUpperCase())
    .nullable()
    .optional(),
  billing_address: z
    .string()
    .trim()
    .max(MAX_ADDRESS_LENGTH, `Maximálne ${MAX_ADDRESS_LENGTH} znakov`)
    .transform(sanitizeText)
    .nullable()
    .optional(),
  hourly_rate: z
    .number()
    .min(0, "Hodinová sadzba nemôže byť záporná")
    .max(1000, "Neplatná hodinová sadzba")
    .nullable()
    .optional(),
  is_vat_payer: z.boolean().default(false),
  vat_number: z
    .string()
    .trim()
    .max(20, "Maximálne 20 znakov")
    .regex(/^[A-Z]{2}[0-9]+$|^$/, "Neplatný formát IČ DPH")
    .transform((val) => val.toUpperCase())
    .nullable()
    .optional(),
  ico: z
    .string()
    .trim()
    .max(20, "Maximálne 20 znakov")
    .regex(/^[0-9]*$|^$/, "IČO môže obsahovať len čísla")
    .nullable()
    .optional(),
  dic: z
    .string()
    .trim()
    .max(20, "Maximálne 20 znakov")
    .regex(/^[0-9]*$|^$/, "DIČ môže obsahovať len čísla")
    .nullable()
    .optional(),
});

// Performance record validation schema
export const performanceRecordSchema = z.object({
  project_id: z.string().uuid("Neplatný projekt"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný formát dátumu"),
  time_from: z.string().regex(/^\d{2}:\d{2}$/, "Neplatný formát času"),
  time_to: z.string().regex(/^\d{2}:\d{2}$/, "Neplatný formát času"),
  break_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Neplatný formát času")
    .nullable()
    .optional(),
  break_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Neplatný formát času")
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .max(MAX_NOTE_LENGTH, `Maximálne ${MAX_NOTE_LENGTH} znakov`)
    .transform(sanitizeText)
    .nullable()
    .optional(),
  total_hours: z
    .number()
    .min(0, "Hodiny nemôžu byť záporné")
    .max(24, "Maximálne 24 hodín za deň"),
});

// Advance validation schema
export const advanceSchema = z.object({
  amount: z
    .number()
    .positive("Suma musí byť väčšia ako 0")
    .max(100000, "Neplatná suma"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný formát dátumu"),
  note: z
    .string()
    .trim()
    .max(MAX_NOTE_LENGTH, `Maximálne ${MAX_NOTE_LENGTH} znakov`)
    .transform(sanitizeText)
    .nullable()
    .optional(),
});

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().email("Neplatný e-mail").max(255, "E-mail je príliš dlhý"),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov"),
});

export const signupSchema = z.object({
  email: z.string().email("Neplatný e-mail").max(255, "E-mail je príliš dlhý"),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov"),
  full_name: z
    .string()
    .trim()
    .min(1, "Meno je povinné")
    .max(MAX_NAME_LENGTH, `Maximálne ${MAX_NAME_LENGTH} znakov`)
    .transform(sanitizeText),
  company_name: z
    .string()
    .trim()
    .max(MAX_NAME_LENGTH, `Maximálne ${MAX_NAME_LENGTH} znakov`)
    .transform(sanitizeText)
    .optional(),
});

// Project validation schema
export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Názov projektu je povinný")
    .max(200, "Maximálne 200 znakov")
    .transform(sanitizeText),
  client: z
    .string()
    .trim()
    .min(1, "Klient je povinný")
    .max(200, "Maximálne 200 znakov")
    .transform(sanitizeText),
  location: z
    .string()
    .trim()
    .max(MAX_ADDRESS_LENGTH, `Maximálne ${MAX_ADDRESS_LENGTH} znakov`)
    .transform(sanitizeText)
    .nullable()
    .optional(),
});

// Type exports
export type ProfileInput = z.infer<typeof profileSchema>;
export type PerformanceRecordInput = z.infer<typeof performanceRecordSchema>;
export type AdvanceInput = z.infer<typeof advanceSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
