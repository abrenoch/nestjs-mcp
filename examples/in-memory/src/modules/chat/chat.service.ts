import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
} from 'openai/resources';

import { McpService } from '../mcp/mcp.service';
import { OpenAiService } from '../../services/openai.service';

@Injectable()
export class ChatService extends EventEmitter {
  private readonly logger = new Logger(ChatService.name);
  readonly #useModel = 'gpt-4o-mini';
  #availableTools: ChatCompletionTool[] = [];
  #currentMessages: ChatCompletionMessageParam[] = [];
  #resolveConversation: ((value: ChatCompletionMessageParam[]) => void) | null = null;

  constructor(
    private readonly mcpService: McpService,
    private readonly openAiService: OpenAiService,
  ) {
    super();
    this.on('toolCalls', this.handleToolCalls.bind(this));
    this.on('assistantResponse', this.handleAssistantResponse.bind(this));
  }
    private async handleToolCalls(toolCalls: any[]) {
    this.logger.debug(`Processing ${toolCalls.length} tool calls`);
    
    // Create promises for each tool call
    const promises = toolCalls.map(({ function: func, id }) => {
      try {
        const argsDecoded = JSON.parse(func.arguments) as Record<string, unknown>;
        return this.mcpService.callTool(func.name, func.arguments)
          .then(result => ({ id, result }));
      } catch (err) {
        this.logger.error(`Error processing tool call arguments: ${(err as Error).message}`);
        return Promise.resolve({ 
          id, 
          result: { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] } 
        });
      }
    });

    // Wait for all tool calls to complete
    const results = await Promise.all(promises);
    
    this.logger.debug(`Tool call results: ${JSON.stringify(results)}`);

    // Add tool response messages and emit completion events
    for (const { id, result } of results) {
      // Emit that this tool call has completed
      this.emit('toolCallComplete', { id, result });
      
      this.#currentMessages.push({
        role: 'tool',
        tool_call_id: id,
        content: JSON.stringify(result.content),
      });
    }

    // Get the final assistant response with the tool results
    const stream = await this.openAiService.streamCompletion(
      this.#currentMessages,
      this.#useModel,
      'text',
      await this.mapMcpToolsToChatCompletionTools(),
    );
    
    // Process the stream for the final assistant response
    this.processResponseStream(stream);
  }
    private async handleAssistantResponse(message: string) {
    if (this.#resolveConversation) {
      // Add the final response to the conversation
      this.#currentMessages.push({
        role: 'assistant',
        content: message,
      });
      
      this.#resolveConversation(this.#currentMessages);
      this.#resolveConversation = null;
    }
  }
    private async processResponseStream(stream: any) {
    // Initialize variables to track the streamed response
    let assistantMessage = '';
    let toolCalls: any[] = [];
    let currentToolCall: any = null;
    
    // Process the stream chunks
    for await (const chunk of stream) {
      // Extract delta content from the chunk if available
      const deltaContent = chunk.choices[0]?.delta?.content;
      if (deltaContent) {
        assistantMessage += deltaContent;
        // this.logger.debug(`Received content chunk: ${deltaContent}`);
        
        this.emit('streamChunk', deltaContent);
      }
      
      // Check for tool calls in the delta
      const deltaToolCalls = chunk.choices[0]?.delta?.tool_calls;
      if (deltaToolCalls?.length) {
        this.logger.debug(`Received tool calls: ${JSON.stringify(deltaToolCalls)}`);
        
        const deltaToolCall = deltaToolCalls[0];
        
        // If this is the start of a new tool call
        if (deltaToolCall.index !== undefined) {
          const toolCallId = deltaToolCall.id || `tool-call-${toolCalls.length}`;
          
          if (!currentToolCall) {
            currentToolCall = {
              id: toolCallId,
              type: 'function',
              function: {
                name: '',
                arguments: '',
              },
            };
            toolCalls.push(currentToolCall);
            
            // Emit that we're starting a tool call
            this.emit('toolCallStart', { id: toolCallId });
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
        if (toolCalls.length > 0) {
          // Create assistant message with tool calls for conversation history
          const assistantToolCallMessage: ChatCompletionMessageParam = {
            role: 'assistant',
            content: '',
            tool_calls: toolCalls,
          };
          
          this.#currentMessages.push(assistantToolCallMessage);
          this.emit('toolCalls', toolCalls);
          return;
        }
      } else if (chunk.choices[0]?.finish_reason === 'stop') {
        // Stream is complete with a regular response
        this.emit('assistantResponse', assistantMessage);
      }
    }
    
    // If we got here without a finish_reason but have content, emit it
    if (assistantMessage && !toolCalls.length) {
      this.emit('assistantResponse', assistantMessage);
    }
  }

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
    
    // Emit that we're starting the stream
    this.emit('streamStart');

    const newMessages = await this.converse(messages);
    const newMessagesOnly = newMessages.slice(messages.length - 1);

    // Emit that the stream is complete with final messages
    this.emit('streamComplete', []);

    return newMessagesOnly;
  }
  async converse(
    messages: ChatCompletionMessageParam[],
  ): Promise<ChatCompletionMessageParam[]> {
    // Store the messages for use in event handlers
    this.#currentMessages = [...messages];
    
    // Get the tools
    const tools = await this.mapMcpToolsToChatCompletionTools();
    
    // Create a promise that will be resolved when the conversation is complete
    const conversationPromise = new Promise<ChatCompletionMessageParam[]>((resolve) => {
      this.#resolveConversation = resolve;
    });
    
    // Start streaming completion
    const stream = await this.openAiService.streamCompletion(
      this.#currentMessages,
      this.#useModel,
      'text',
      tools,
    );
    
    // Process the stream using our event-driven approach
    this.processResponseStream(stream);
    
    // Wait for conversation to complete via events
    return conversationPromise;
  }
}