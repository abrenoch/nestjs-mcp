<template>
  <div class="chat-container">
    <div class="chat-header">
      <h2>LLM Chat Interface</h2>
      <div class="connection-status" :class="{ connected: isConnected }">
        {{ isConnected ? 'Connected' : 'Disconnected' }}
      </div>
    </div>
    
    <div class="messages-container" ref="messagesContainer">
      <div v-for="(message, index) in messages" 
           :key="index" 
           class="message" 
           :class="message.role">
        <div class="message-role">{{ message.role === 'user' ? 'You' : 'AI' }}</div>
        <div class="message-content">{{ message.content }}</div>
      </div>
      <div v-if="isLoading" class="message ai loading">
        <div class="message-role">AI</div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="input-container">
      <input 
        v-model="userInput" 
        type="text" 
        placeholder="Type your message..." 
        @keyup.enter="sendMessage"
        :disabled="!isConnected || isLoading"
      />
      <button 
        @click="sendMessage" 
        :disabled="!isConnected || !userInput.trim() || isLoading">
        Send
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { socketService } from '../services/socket.service';

const userInput = ref('');
const isLoading = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

// Using the socket service
const isConnected = socketService.isConnected;
const messages = socketService.messages;

// Connect to socket on component mount
onMounted(() => {
  socketService.connect();
});

// Disconnect on component unmount
onUnmounted(() => {
  socketService.disconnect();
});

// Auto scroll to bottom when messages change
watch(messages, async () => {
  isLoading.value = false;
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}, { deep: true });

// Send message function
const sendMessage = () => {
  if (!userInput.value.trim() || !isConnected.value || isLoading.value) return;
  
  isLoading.value = true;
  socketService.sendMessage(userInput.value.trim());
  userInput.value = '';
};
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 800px;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background-color: #fff;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #4f46e5;
  color: white;
}

.chat-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.connection-status {
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  background-color: #ef4444;
}

.connection-status.connected {
  background-color: #10b981;
}

.messages-container {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: #f9fafb;
}

.message {
  max-width: 80%;
  padding: 10px 15px;
  border-radius: 10px;
  position: relative;
}

.message.user {
  align-self: flex-end;
  background-color: #4f46e5;
  color: white;
}

.message.ai {
  align-self: flex-start;
  background-color: #e5e7eb;
  color: #1f2937;
}

.message-role {
  font-weight: bold;
  margin-bottom: 3px;
  font-size: 0.8rem;
}

.message-content {
  word-break: break-word;
}

.input-container {
  display: flex;
  padding: 15px;
  border-top: 1px solid #e5e7eb;
}

input {
  flex-grow: 1;
  padding: 10px 15px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  margin-right: 10px;
  font-size: 1rem;
}

button {
  padding: 10px 20px;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #4338ca;
}

button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.typing-indicator {
  display: flex;
  align-items: center;
}

.typing-indicator span {
  height: 8px;
  width: 8px;
  background-color: #6b7280;
  border-radius: 50%;
  display: inline-block;
  margin: 0 2px;
  opacity: 0.4;
  animation: bounce 1.2s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-5px); }
}
</style>
