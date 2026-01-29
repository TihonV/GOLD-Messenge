// server.js - Бэкенд использующий GitHub API как базу данных
const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const jwt = require('jsonwebtoken');
const app = express();

app.use(cors());
app.use(express.json());

// Инициализация Octokit с GitHub токеном
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: 'Messenger App v1.0'
});

const REPO_OWNER = 'ваш-юзернейм';
const REPO_NAME = 'messenger-data';

// Хранилище в памяти (для активных сессий)
const activeUsers = new Map();
const pendingCalls = new Map();

// 1. Аутентификация
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Проверяем пользователя через GitHub Issues
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: 'user',
      state: 'all'
    });
    
    const user = issues.find(issue => 
      issue.title === username && 
      issue.body.includes(`password:${password}`)
    );
    
    if (user) {
      const token = jwt.sign(
        { userId: user.number, username },
        process.env.JWT_SECRET
      );
      res.json({ token, user: { id: user.number, username } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Регистрация
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email } = req.body;
  
  try {
    // Создаем нового пользователя как GitHub Issue
    const { data: newUser } = await octokit.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: username,
      body: `email:${email}\npassword:${password}\ndata:${JSON.stringify({
        createdAt: new Date().toISOString(),
        contacts: [],
        settings: {}
      })}`,
      labels: ['user']
    });
    
    const token = jwt.sign(
      { userId: newUser.number, username },
      process.env.JWT_SECRET
    );
    
    res.json({ 
      token, 
      user: { 
        id: newUser.number, 
        username,
        avatar: `https://github.com/${REPO_OWNER}.png`
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Сигнальный сервер для WebRTC (без WebSocket!)
app.post('/api/calls/signal', async (req, res) => {
  const { from, to, signal, type } = req.body;
  
  try {
    // Сохраняем сигнал в GitHub Issue (имитация WebSocket)
    const { data: signalIssue } = await octokit.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `call-signal-${Date.now()}`,
      body: JSON.stringify({
        from,
        to,
        signal,
        type,
        timestamp: new Date().toISOString()
      }),
      labels: ['call-signal']
    });
    
    // Также сохраняем в память для быстрого доступа
    if (!pendingCalls.has(to)) {
      pendingCalls.set(to, []);
    }
    pendingCalls.get(to).push({ from, signal, type });
    
    res.json({ success: true, signalId: signalIssue.number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Получение сигналов (long-polling)
app.get('/api/calls/signals/:userId', async (req, res) => {
  const userId = req.params.userId;
  const timeout = 30000; // 30 секунд timeout
  
  const startTime = Date.now();
  
  // Long-polling: ждем сигналы
  const checkForSignals = async () => {
    try {
      // Проверяем в памяти
      const signals = pendingCalls.get(userId) || [];
      
      if (signals.length > 0) {
        pendingCalls.set(userId, []);
        return res.json({ signals });
      }
      
      // Проверяем GitHub Issues
      const { data: issues } = await octokit.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        labels: 'call-signal',
        state: 'open'
      });
      
      const userSignals = issues.filter(issue => {
        const body = JSON.parse(issue.body);
        return body.to === userId;
      });
      
      if (userSignals.length > 0) {
        // Закрываем issues после получения
        for (const issue of userSignals) {
          await octokit.issues.update({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            issue_number: issue.number,
            state: 'closed'
          });
        }
        
        const signals = userSignals.map(issue => JSON.parse(issue.body));
        return res.json({ signals });
      }
      
      // Если время вышло
      if (Date.now() - startTime > timeout) {
        return res.json({ signals: [] });
      }
      
      // Ждем 1 секунду и проверяем снова
      setTimeout(checkForSignals, 1000);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  checkForSignals();
});

// 5. Сохранение сообщений в GitHub
app.post('/api/messages', async (req, res) => {
  const { from, to, text } = req.body;
  
  try {
    // Сохраняем сообщение как comment к специальному issue
    const issueTitle = `chat-${[from, to].sort().join('-')}`;
    
    // Ищем или создаем issue для чата
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'all'
    });
    
    let chatIssue = issues.find(issue => issue.title === issueTitle);
    
    if (!chatIssue) {
      const { data: newIssue } = await octokit.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: issueTitle,
        body: 'Chat messages will appear here as comments',
        labels: ['chat']
      });
      chatIssue = newIssue;
    }
    
    // Добавляем сообщение как комментарий
    await octokit.issues.createComment({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: chatIssue.number,
      body: JSON.stringify({
        from,
        to,
        text,
        timestamp: new Date().toISOString()
      })
    });
    
    res.json({ success: true, messageId: Date.now() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Получение сообщений
app.get('/api/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  const issueTitle = `chat-${[user1, user2].sort().join('-')}`;
  
  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'all'
    });
    
    const chatIssue = issues.find(issue => issue.title === issueTitle);
    
    if (!chatIssue) {
      return res.json({ messages: [] });
    }
    
    // Получаем все комментарии (сообщения)
    const { data: comments } = await octokit.issues.listComments({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: chatIssue.number
    });
    
    const messages = comments.map(comment => {
      try {
        return JSON.parse(comment.body);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GitHub Messenger API running on port ${PORT}`);
});
