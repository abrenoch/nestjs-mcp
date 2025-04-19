import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';

class SocketService {
  private socket: Socket | null = null;
  public isConnected = ref(false);
  public messages = ref<{ role: string; content: string }[]>([]);

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

    this.socket.on('message', (messages: Array<{ role: string; content: string }>) => {
      console.log('Received messages:', messages);
      this.messages.value.push(...messages);
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
