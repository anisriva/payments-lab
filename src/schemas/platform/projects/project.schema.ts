import { z } from 'zod';
export const projectCreateSchema = z.object({ name: z.string().min(1).max(150), countryCode: z.string().length(2) });
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
