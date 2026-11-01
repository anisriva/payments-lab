import { z } from 'zod';
export const projectCreateSchema = z.object({ name: z.string().min(1).max(150), countryCode: z.string().length(2) });
export const projectUpdateSchema = z.object({ name: z.string().min(1).max(150).optional(), countryCode: z.string().length(2).optional() });
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
