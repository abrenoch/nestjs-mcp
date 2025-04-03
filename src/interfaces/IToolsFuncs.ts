import { type z } from 'zod';

export interface IToolsFuncs {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  func: Function;
}
