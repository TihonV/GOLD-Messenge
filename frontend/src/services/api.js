// API сервис для работы с GitHub-based бэкендом
const API_BASE_URL = 'https://ваш-юзернейм.github.io/messenger-data/api';

export class GitHubMessengerAPI {
  constructor() {
    this.token = localStorage.getItem('token');
  }
  
  // Long-polling для получения сигналов WebRTC
  async pollSignals(userId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/calls/signals/${userId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      return data.signals || [];
    } catch (error) {
      console.error('Polling error:', error);
      return [];
    }
  }
  
  // Отправка сигнала WebRTC
  async sendSignal(from, to, signal, type = 'offer') {
    try {
      const response = await fetch(`${API_BASE_URL}/calls/signal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from, to, signal, type })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Signal error:', error);
      return { success: false };
    }
  }
  
  // Регистрация/логин
  async register(username, password, email) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email })
    });
    
    return await response.json();
  }
  
  async login(username, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    return await response.json();
  }
  
  // Отправка сообщения
  async sendMessage(from, to, text) {
    const response = await fetch(`${API_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, text })
    });
    
    return await response.json();
  }
  
  // Получение сообщений
  async getMessages(user1, user2) {
    const response = await fetch(
      `${API_BASE_URL}/messages/${user1}/${user2}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return await response.json();
  }
}

export const api = new GitHubMessengerAPI();
