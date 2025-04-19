import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
  ChatCompletionTool,
    type ChatCompletionMessageParam,
  } from 'openai/resources';
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { ApiConfigService } from './api-config.service';

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;

  private readonly DEFAULT_COMPLETION_MODEL = 'gpt-4o-mini';

  constructor(private readonly apiConfigService: ApiConfigService) {
    this.client = new OpenAI({
      apiKey: this.apiConfigService.openAiApiKey,
    });
  }

  async textCompletion(
    messages: ChatCompletionMessageParam[] = [],
    modelId: string = this.DEFAULT_COMPLETION_MODEL,
    responseFormat: 'text' | 'json_schema' | 'json_object' = 'text',
    tools: ChatCompletionTool[] = [],
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.client.chat.completions.create({
      response_format: {
        type: responseFormat,
      } as ChatCompletionCreateParamsBase['response_format'],
      messages,
      tools,
      model: modelId,
    });
  }

  async streamCompletion(
    messages: ChatCompletionMessageParam[] = [],
    modelId: string = this.DEFAULT_COMPLETION_MODEL,
    responseFormat: 'text' | 'json_schema' | 'json_object' = 'text',
    tools: ChatCompletionTool[] = [],
  ) {
    return this.client.chat.completions.create({
      response_format: {
        type: responseFormat,
      } as ChatCompletionCreateParamsBase['response_format'],
      messages,
      tools,
      model: modelId,
      stream: true,
    });
  }
}