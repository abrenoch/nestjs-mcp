import { type z } from 'zod';

export interface IToolOptions {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
}
