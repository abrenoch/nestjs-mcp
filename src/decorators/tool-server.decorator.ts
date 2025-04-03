import { z } from 'zod';

import { type IMcpOptions } from '../interfaces';

const mcpOptionsSchema = z.object({
  version: z.string(),
  name: z.string(),
  tools: z.array(z.any()).optional(), // Add this to accept tool classes
});

export function ToolServer(options: IMcpOptions): ClassDecorator {
  mcpOptionsSchema.parse(options);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return function <T extends Function>(constructor: T): T {
    Reflect.defineMetadata('mcp:options', options, constructor);

    // Store the tool classes for later use in the server
    if (options.tools) {
      Reflect.defineMetadata('mcp:toolClasses', options.tools, constructor);
    }

    return constructor;
  };
}
