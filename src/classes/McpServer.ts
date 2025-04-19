/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inmemory.js';
import { McpServer as OgServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ListToolsResult } from '@modelcontextprotocol/sdk/types';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class McpServer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  readonly #logger = new Logger(McpServer.name);

  #server: OgServer | null = null;

  #serverTransport: InMemoryTransport | null = null;

  #clientTransport: InMemoryTransport | null = null;

  #client: Client | null = null;

  #tools?: ListToolsResult;

  constructor(protected readonly moduleRef: ModuleRef) {}

  async onApplicationBootstrap() {
    this.#logger.log('Server is starting...');
    await this.startWorker();
    this.#logger.log('Server has started.');
  }

  async onApplicationShutdown(signal?: string) {
    this.#logger.log(`Server is shutting down due to signal: ${signal}`);
    await this.stopWorker();
    this.#logger.log('Server has stopped.');
  }

  private async startWorker() {
    if (this.#server) {
      return;
    }

    // get the options from the class metadata
    const options = Reflect.getMetadata('mcp:options', this.constructor);

    this.#server = new OgServer({
      version: options.version,
      name: options.name,
    });

    this.mountTools();

    [this.#serverTransport, this.#clientTransport] =
      InMemoryTransport.createLinkedPair();

    await this.#server.connect(this.#serverTransport);

    this.#client = new Client({
      name: `${options.name} client`,
      version: options.version,
    });

    await Promise.all([
      this.#client.connect(this.#clientTransport),
      this.#server.connect(this.#serverTransport),
    ]);
  }

  private async stopWorker() {
    if (this.#server) {
      await this.#server.close();
      this.#server = null;
    }
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private mountTools() {
    if (!this.#server) {
      throw new Error('Server is not initialized.');
    }

    // Get tool classes from metadata
    const toolClasses =
      Reflect.getMetadata('mcp:toolClasses', this.constructor) || [];

    // For each registered tool class, get the instance from ModuleRef

    for (const ToolClass of toolClasses) {
      try {
        // Get the instance from NestJS DI system
        const toolInstance = this.moduleRef.get(ToolClass, { strict: false });

        if (!toolInstance) {
          this.#logger.warn(
            `No instance found for tool class ${ToolClass.name}`,
          );
          continue;
        }

        const prototype = Object.getPrototypeOf(toolInstance);

        // Register all tool methods for this instance
        for (const methodName of Object.getOwnPropertyNames(prototype)) {
          if (methodName === 'constructor') {
            continue;
          }

          const toolName = Reflect.getMetadata(
            'tool:name',
            prototype.constructor,
            methodName,
          );

          if (toolName) {
            const description =
              Reflect.getMetadata(
                'tool:description',
                prototype.constructor,
                methodName,
              ) || 'No description provided';

            const inputSchema = Reflect.getMetadata(
              'tool:inputSchema',
              prototype.constructor,
              methodName,
            );

            this.#server.tool(
              toolName,
              description,
              inputSchema,
              // eslint-disable-next-line @typescript-eslint/require-await
              async (...args: unknown[]) => {
                const method = (toolInstance[methodName] as Function).bind(
                  toolInstance,
                ) as (...args: unknown[]) => any;

                return method(...args);
              },
            );

            this.#logger.log(`Tool "${toolName}" registered`);
          }
        }
      } catch (error) {
        this.#logger.error(
          `Error loading tool class ${ToolClass.name}:`,
          error,
        );
      }
    }
  }

  async getTools(): Promise<ListToolsResult> {
    if (!this.#client) {
      throw new Error(
        'Client is not initialized. Please start the worker first.',
      );
    }

    if (this.#tools) {
      return this.#tools;
    }

    this.#tools = await this.#client.listTools().catch((error) => {
      this.#logger.error('Error fetching tools:', error);

      throw error;
    });

    return this.#tools;
  }

  async callTool(toolName: string, params: Record<string, unknown> | string) {
    if (!this.#client) {
      throw new Error(
        'Client is not initialized. Please start the worker first.',
      );
    }

    return this.#client
      .callTool({
        name: toolName,
        arguments:
          typeof params === 'string'
            ? (JSON.parse(params) as Record<string, unknown>)
            : params,
      })
      .catch((error) => {
        this.#logger.error(`Error calling tool ${toolName}:`, error);

        throw error;
      });
  }

  get client(): Client {
    if (!this.#client) {
      throw new Error(
        'Client is not initialized. Please start the worker first.',
      );
    }

    return this.#client;
  }
}
