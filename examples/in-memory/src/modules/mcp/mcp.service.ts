import { ToolServer, McpServer } from 'nestjs-mcp'

@ToolServer({
  version: '0.1.0',
  name: 'MCP Worker',
  tools: [],
})
export class McpService extends McpServer {}