import { Injectable } from '@nestjs/common';
import { Tool } from 'nestjs-mcp';

@Injectable()
export class TestTools {
//   constructor() {}

  @Tool({
    name: 'get_current_datetime',
    description: 'Returns the current datetime in ISO format',
    inputSchema: {},
  })
  async getCurrentDatetime(): Promise<string> {
    return Date.now().toString();
  }
}