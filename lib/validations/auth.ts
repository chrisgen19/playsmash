import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(80),
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
