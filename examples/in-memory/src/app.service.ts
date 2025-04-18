import { Injectable } from '@nestjs/common';
import { McpServer, ToolServer } from 'nestjs-mcp';

@Injectable()
@ToolServer({
  name: 'example',
  version: '1.0.0',
})
export class AppService extends McpServer {
  getHello(): string {
    return 'Hello World!';
  }
}
