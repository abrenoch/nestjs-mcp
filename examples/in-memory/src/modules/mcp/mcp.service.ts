import { ToolServer, McpServer } from 'nestjs-mcp'
import { TestTools } from './tools/test.tools';

@ToolServer({
  version: '0.1.0',
  name: 'MCP Worker',
  tools: [TestTools],
})
export class McpService extends McpServer {}