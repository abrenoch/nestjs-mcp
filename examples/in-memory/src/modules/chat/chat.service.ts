import { Inject, Injectable } from '@nestjs/common';
import {
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
} from 'openai/resources';

import { McpService } from '../mcp/mcp.service';
import { OpenAiService } from '../../services/openai.service';

@Injectable()
export class ChatService {
  readonly #useModel = 'gpt-4o-mini';

  #availableTools: ChatCompletionTool[] = [];

  constructor(
    private readonly mcpService: McpService,
    private readonly openAiService: OpenAiService,
  ) {}

  private async mapMcpToolsToChatCompletionTools(): Promise<
    ChatCompletionTool[]
  > {
    if (this.#availableTools.length > 0) {
      return this.#availableTools;
    }

    const tools = await this.mcpService.getTools();

    this.#availableTools = tools.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema,
      },
    }));

    return this.#availableTools;
  }

  async sendMessage(
    chatKey: string,
    message: string,
  ): Promise<ChatCompletionMessageParam[]> {
    // const messages = await this.getCachedMessages(chatKey)
    const messages: ChatCompletionMessageParam[] = [];

    messages.push({ role: 'user', content: message });

    // console.log('Messages:', messages);

    const newMessages = await this.converse(messages);
    const newMessagesOnly = newMessages.slice(messages.length - 1);

    // await this.cacheManager.set(
    //   `conversation:${chatKey}`,
    //   newMessages,
    //   1000 * 60 * 60 * 24 * 30,
    // );

    return newMessagesOnly;
  }

  async converse(
    messages: ChatCompletionMessageParam[],
  ): Promise<ChatCompletionMessageParam[]> {
    const tools = await this.mapMcpToolsToChatCompletionTools();

    const response = await this.openAiService.textCompletion(
      messages,
      this.#useModel,
      'text',
      tools,
    );

    const choice = response.choices[0];
    messages.push(choice.message);

    if (choice.finish_reason === 'tool_calls') {
      const toolsToUse = choice.message.tool_calls || [];
      const promises = toolsToUse.map(({ function: func }) => {
        const argsDecoded = JSON.parse(func.arguments) as Record<
          string,
          unknown
        >;

        return this.mcpService.callTool(func.name, func.arguments);
      });

      const results = await Promise.all(promises);

      for (const [, result] of results.entries()) {
        messages.push({
          role: 'tool',
          tool_call_id: toolsToUse[0].id,
          content: JSON.stringify(result.content),
        });
      }

      const nextResponse =
        await this.openAiService.textCompletion(
          messages,
          this.#useModel,
          'text',
          tools,
        );

      messages.push({
        role: 'assistant',
        content: nextResponse.choices[0].message.content,
      });
    }

    return messages;
  }
}