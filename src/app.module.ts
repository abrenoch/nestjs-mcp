import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../users/user.entity';
// import { UserService } from '../users/user.service';
import { McpService } from './mcp.service';
import { TestToolset } from './tools/test.tools';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [McpService, TestToolset],
  controllers: [],
  exports: [McpService],
})
export class McpModule {}
