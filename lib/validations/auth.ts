import { z } from "zod";

export const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(40, { message: "First name is too long" }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(40, { message: "Last name is too long" }),
  email: z
    .email({ message: "Enter a valid email" })
    .trim()
    .toLowerCase()
    .max(160),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, { message: "Password is required" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
