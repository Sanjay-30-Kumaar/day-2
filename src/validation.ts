import { z } from "zod";

export const contactSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .email("Email must be a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[1-9]\d{9,14}$/,
      "Phone must contain 10 to 15 digits and may start with +",
    ),
  tags: z.array(z.string().trim().min(1, "Tags cannot be empty")),
});

export const newContactSchema = contactSchema.omit({
  id: true,
});

export type ContactInput = z.infer<typeof newContactSchema>;