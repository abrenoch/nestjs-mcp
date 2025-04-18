import { Module } from '@nestjs/common';

import { McpService } from './mcp.service';
import { TestTools } from './tools/test.tools';

@Module({
  providers: [McpService, TestTools],
  controllers: [],
  exports: [McpService],
})
export class McpModule {}