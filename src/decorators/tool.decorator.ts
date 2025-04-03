import 'reflect-metadata';

import { type IToolOptions, type IToolResult } from '../interfaces';

/**
 * Decorator that marks a method as a tool with name, description and schemas
 */
export function Tool(options: IToolOptions): MethodDecorator {
  return (
    target: () => string,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(
      'tool:description',
      options.description,
      target.constructor,
      propertyKey,
    );
    Reflect.defineMetadata(
      'tool:inputSchema',
      options.inputSchema,
      target.constructor,
      propertyKey,
    );
    // Reflect.defineMetadata(
    //   'tool:responseSchema',
    //   options.responseSchema,
    //   target.constructor,
    //   propertyKey,
    // );

    Reflect.defineMetadata(
      'tool:handler',
      true,
      target.constructor,
      propertyKey,
    );

    if (typeof descriptor.value !== 'function') {
      throw new TypeError(
        `Tool decorator can only be applied to methods. '${String(propertyKey)}' is not a method.`,
      );
    }

    const ogFunc = descriptor.value as () => Promise<unknown>;

    descriptor.value = async function (
      ...args: unknown[]
    ): Promise<IToolResult> {
      const result = (await ogFunc.apply(this, args)) as Promise<unknown>;

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result),
          },
        ],
      };
    };

    Reflect.defineMetadata(
      'tool:name',
      options.name,
      target.constructor,
      propertyKey,
    );

    return descriptor;
  };
}
