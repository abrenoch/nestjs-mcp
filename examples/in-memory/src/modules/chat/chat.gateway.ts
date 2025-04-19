/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*', // As string instead of array
    methods: ['GET', 'POST'],
    // allowedHeaders: ['content-type', 'Authorization'],
    credentials: false, // Set to false to see if that helps
  },
  transports: ['websocket', 'polling'], // Explicitly define transports
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer() io: Server;

  constructor(private readonly chatService: ChatService) {}

  afterInit() {
    this.logger.log('Initialized');
  }

  handleConnection(client: any) {
    const { sockets } = this.io.sockets;

    this.logger.log(`Client id: ${client.id} connected`);
    this.logger.debug(`Number of connected clients: ${sockets.size}`);
  }

  handleDisconnect(client: any) {
    this.logger.log(`Cliend id:${client.id} disconnected`);
  }

  @SubscribeMessage('ping')
  handlePing(client: any, data: any) {
    this.logger.log(`Message received from client id: ${client.id}`);
    this.logger.debug(`Payload: ${data}`);

    return {
      event: 'pong',
      data: 'Wrong data that will make the test fail',
    };
  }
  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    this.logger.log(`Message received from client id: ${client.id}`);

    // Setup streaming handlers
    this.chatService.on('streamStart', () => {
      client.emit('streamStart', { id: client.id });
    });

    this.chatService.on('streamChunk', (chunk) => {
      client.emit('streamChunk', { chunk });
    });

    this.chatService.on('toolCallStart', (toolCall) => {
      client.emit('toolCallStart', { toolCall });
    });

    this.chatService.on('toolCallComplete', (result) => {
      client.emit('toolCallComplete', { result });
    });

    this.chatService.on('streamComplete', (finalMessages) => {
      client.emit('streamComplete', { messages: finalMessages });
      
      // Remove event listeners once streaming is complete
      this.chatService.removeAllListeners('streamStart');
      this.chatService.removeAllListeners('streamChunk');
      this.chatService.removeAllListeners('toolCallStart');
      this.chatService.removeAllListeners('toolCallComplete');
      this.chatService.removeAllListeners('streamComplete');
    });

    // Start the conversation
    await this.chatService.sendMessage(String(client.id), String(data));
    
    // Return acknowledgement, but actual response will be streamed through events
    return {
      event: 'messageReceived',
      data: { status: 'processing' },
    };
  }
}