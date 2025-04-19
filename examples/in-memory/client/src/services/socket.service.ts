import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';

class SocketService {
  private socket: Socket | null = null;
  public isConnected = ref(false);
  public messages = ref<{ role: string; content: string }[]>([]);
  public isStreaming = ref(false);
  public currentStreamedMessage = ref('');
  public toolCallInProgress = ref(false);
  public currentToolCall = ref<any>(null);

  connect() {
    if (this.socket) return;

    // Connect to the NestJS backend
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected.value = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected.value = false;
    });

    // Legacy handler for non-streaming messages
    this.socket.on('message', (messages: Array<{ role: string; content: string }>) => {
      console.log('Received messages:', messages);
      this.messages.value.push(...messages);
    });

    // New streaming event handlers
    this.socket.on('streamStart', () => {
      console.log('Stream started');
      this.isStreaming.value = true;
      this.currentStreamedMessage.value = '';
    });

    this.socket.on('streamChunk', ({ chunk }) => {
      console.log('Received chunk:', chunk);
      this.currentStreamedMessage.value += chunk;
    });

    this.socket.on('toolCallStart', ({ toolCall }) => {
      console.log('Tool call started:', toolCall);
      this.toolCallInProgress.value = true;
      this.currentToolCall.value = toolCall;
    });

    this.socket.on('toolCallComplete', ({ result }) => {
      console.log('Tool call completed:', result);
      this.toolCallInProgress.value = false;
    });

    this.socket.on('streamComplete', ({ messages }) => {
      console.log('Stream completed with messages:', messages);
      this.isStreaming.value = false;
      
      // Add the completed streamed message to our messages list
      if (this.currentStreamedMessage.value) {
        this.messages.value.push({ 
          role: 'assistant', 
          content: this.currentStreamedMessage.value 
        });
        this.currentStreamedMessage.value = '';
      }
      
      // Add any other messages that might have been returned
      if (messages && messages.length > 0) {
        // Filter out messages that might duplicate what we've already added
        const newMessages = messages.filter(msg => 
          msg.role !== 'assistant' || 
          !this.messages.value.some(m => 
            m.role === 'assistant' && 
            m.content === msg.content
          )
        );
        
        if (newMessages.length > 0) {
          this.messages.value.push(...newMessages);
        }
      }
    });
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
    this.isConnected.value = false;
  }

  sendMessage(content: string) {
    if (!this.socket || !this.isConnected.value) {
      console.error('Not connected to server');
      return;
    }

    // Add user message to local messages
    this.messages.value.push({ role: 'user', content });

    // Send message to server
    this.socket.emit('message', content);
  }
}

// Create a singleton instance
export const socketService = new SocketService();
