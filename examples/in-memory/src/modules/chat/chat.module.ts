import { Module } from '@nestjs/common';

import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { McpModule } from '../mcp/mcp.module';
import { OpenAiService } from '../../services/openai.service';
import { ApiConfigService } from 'src/services/api-config.service';

@Module({
  imports: [McpModule],
  providers: [ApiConfigService, OpenAiService, ChatService, ChatGateway],
  controllers: [],
})
export class ChatModule {}