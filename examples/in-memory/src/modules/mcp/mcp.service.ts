import { Injectable } from '@nestjs/common';
import { ToolServer, McpServer } from 'nestjs-mcp';
import { ModuleRef } from '@nestjs/core';
import { TestTools } from './tools/test.tools';

@Injectable()
@ToolServer({
  version: '0.1.0',
  name: 'MCP Worker',
  tools: [TestTools],
})
export class McpService extends McpServer {
  constructor(moduleRef: ModuleRef) {
    super(moduleRef as any);  // monorepos cause weird type issues
  }
}