import { Module } from '@nestjs/common';

import { McpService } from './mcp.service';

@Module({
  providers: [McpService],
  controllers: [],
  exports: [McpService],
})
export class McpModule {}