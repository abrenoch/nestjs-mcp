import { Injectable, Logger } from '@nestjs/common';
import {
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
} from 'openai/resources';

import { McpService } from '../mcp/mcp.service';
import { OpenAiService } from '../../services/openai.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
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
    const messages: ChatCompletionMessageParam[] = [];

    messages.push({ role: 'user', content: message });

    const newMessages = await this.converse(messages);
    const newMessagesOnly = newMessages.slice(messages.length - 1);

    return newMessagesOnly;
  }

  async converse(
    messages: ChatCompletionMessageParam[],
  ): Promise<ChatCompletionMessageParam[]> {
    const tools = await this.mapMcpToolsToChatCompletionTools();
    
    // Start streaming completion
    const stream = await this.openAiService.streamCompletion(
      messages,
      this.#useModel,
      'text',
      tools,
    );

    // Initialize variables to track the streamed response
    let assistantMessage: ChatCompletionMessageParam = {
      role: 'assistant',
      content: '',
    };
    let toolCalls: any[] = [];
    let currentToolCall: any = null;
    
    // Process the stream chunks
    for await (const chunk of stream) {
      // Extract delta content from the chunk if available
      const deltaContent = chunk.choices[0]?.delta?.content;
      if (deltaContent) {
        assistantMessage.content = (assistantMessage.content || '') + deltaContent;
      }
      
      // Check for tool calls in the delta
      const deltaToolCalls = chunk.choices[0]?.delta?.tool_calls;
      if (deltaToolCalls?.length) {

        this.logger.debug(`Received tool calls: ${JSON.stringify(deltaToolCalls)}`);
        
        const deltaToolCall = deltaToolCalls[0];
        
        // If this is the start of a new tool call
        if (deltaToolCall.index !== undefined) {
          const toolCallId = deltaToolCall.id || `tool-call-${toolCalls.length}`;
          
          if (!assistantMessage.tool_calls) {
            assistantMessage.tool_calls = [];
          }
          
          if (!currentToolCall) {
            currentToolCall = {
              id: toolCallId,
              type: 'function',
              function: {
                name: '',
                arguments: '',
              },
            };
            assistantMessage.tool_calls.push(currentToolCall);
            toolCalls.push(currentToolCall);
          }
        }
        
        // Update the function name if provided
        if (deltaToolCall.function?.name) {
          currentToolCall.function.name += deltaToolCall.function.name;
        }
        
        // Update the function arguments if provided
        if (deltaToolCall.function?.arguments) {
          currentToolCall.function.arguments += deltaToolCall.function.arguments;
        }
      }
      
      // If this chunk indicates completion of a tool call
      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        break;
      }
    }
    
    // Add the assistant message to the conversation
    messages.push(assistantMessage);
    
    // If there are tool calls to process
    if (toolCalls.length > 0) {
      this.logger.debug(`Processing ${toolCalls.length} tool calls`);

      // Create promises for each tool call
      const promises = toolCalls.map(({ function: func, id }) => {
        try {
          const argsDecoded = JSON.parse(func.arguments) as Record<string, unknown>;
          return this.mcpService.callTool(func.name, func.arguments);
        } catch (err) {
          this.logger.error(`Error processing tool call arguments: ${(err as Error).message}`);
          return Promise.resolve({ content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] });
        }
      });

      // Wait for all tool calls to complete
      const results = await Promise.all(promises);
      
      this.logger.debug(`Tool call results: ${JSON.stringify(results)}`);

      // Add tool response messages
      for (let i = 0; i < results.length; i++) {
        messages.push({
          role: 'tool',
          tool_call_id: toolCalls[i].id,
          content: JSON.stringify(results[i].content),
        });
      }

      // Get the final assistant response with the tool results
      const stream = await this.openAiService.streamCompletion(
        messages,
        this.#useModel,
        'text',
        tools,
      );
      
      // Collect the final response chunks
      let finalResponse = '';
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {

          this.logger.debug(`Received chunk: ${chunk.choices[0].delta.content}`);

          finalResponse += chunk.choices[0].delta.content;
        }
      }
      
      // Add the final response to the conversation
      messages.push({
        role: 'assistant',
        content: finalResponse,
      });
    }

    return messages;
  }
}