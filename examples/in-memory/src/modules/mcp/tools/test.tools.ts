import { Tool } from 'nestjs-mcp';
import { z } from 'zod';

export class TestTools {
  @Tool({
    name: 'get_user_zipcode',
    description: 'Return the user zipcode',
    inputSchema: {},
  })
  async getCurrentDatetime(): Promise<string> {
    return String(49345);
  }

  @Tool({
    name: 'get_zipcode_weather',
    description: 'Return the weather for a given zipcode',
    inputSchema: {
      zipcode: z.string().describe('The zipcode to get the weather for'),
    },
  })
  async getWeather(zipcode: string): Promise<string> {

    console.log('Weather for zipcode:', zipcode);

    return "rainy";
  }

  @Tool({
    name: 'get_users_pets',
    description: 'Return the users pets',
    inputSchema: {},
  })
  async getPets(): Promise<string> {
    return JSON.stringify([
      { name: 'Riley', type: 'dog', status: 'alive' },
      { name: 'Chronic', type: 'cat', status: 'deceased' },
    ]);
  }

}