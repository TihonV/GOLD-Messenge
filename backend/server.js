// server.js - Бэкенд использующий GitHub API как базу данных
const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const jwt = require('jsonwebtoken');
const app = express();
const WebSocket = require('ws');

// ==================== КОНСТАНТЫ ====================
// Эти переменные нужно задать в .env файле или напрямую
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'your_github_token_here';
const REPO_OWNER = process.env.REPO_OWNER || 'tihonv'; // ваш GitHub username
const REPO_NAME = process.env.REPO_NAME || 'messenger-data';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
  userAgent: 'Messenger App v1.0'
});

// Хранилище в памяти
const activeUsers = new Map();
const pendingCalls = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Проверка существования репозитория
async function ensureRepoExists() {
  try {
    await octokit.repos.get({
      owner: REPO_OWNER,
      repo: REPO_NAME
    });
    console.log(`Репозиторий ${REPO_OWNER}/${REPO_NAME} существует`);
  } catch (error) {
    console.error(`Репозиторий ${REPO_OWNER}/${REPO_NAME} не найден!`);
    console.error('Создайте репозиторий на GitHub и добавьте туда issues для хранения данных');
    console.error('Или измените REPO_OWNER и REPO_NAME в коде');
  }
}

// Поиск пользователя по username
async function findUserByUsername(username) {
  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: 'user',
      state: 'all',
      per_page: 100
    });
    
    return issues.find(issue => issue.title === username);
  } catch (error) {
    console.error('Ошибка поиска пользователя:', error);
    return null;
  }
}

// Проверка, занят ли username
async function isUsernameTaken(username) {
  const user = await findUserByUsername(username);
  return user !== undefined;
}

// ==================== API РОУТЫ ====================

// 1. Проверка соединения
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    githubConnected: !!GITHUB_TOKEN,
    repo: `${REPO_OWNER}/${REPO_NAME}`
  });
});

// 2. Аутентификация
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username и password обязательны' });
    }
    
    // Проверяем пользователя
    const userIssue = await findUserByUsername(username);
    
    if (!userIssue) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    // Парсим данные из body issue
    const bodyLines = userIssue.body.split('\n');
    const userData = {};
    
    bodyLines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        userData[key.trim()] = valueParts.join(':').trim();
      }
    });
    
    // Проверяем пароль
    if (userData.password !== password) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }
    
    // Генерируем токен
    const token = jwt.sign(
      { 
        userId: userIssue.number, 
        username: userIssue.title,
        email: userData.email || ''
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Получаем аватар
    let avatar = null;
    if (userData.avatar) {
      avatar = userData.avatar;
    } else {
      // Пробуем получить аватар GitHub
      try {
        const { data: ghUser } = await octokit.users.getByUsername({
          username: REPO_OWNER
        });
        avatar = ghUser.avatar_url;
      } catch (e) {
        console.log('Не удалось получить аватар GitHub');
      }
    }
    
    res.json({ 
      token, 
      user: { 
        id: userIssue.number.toString(),
        username: userIssue.title,
        name: userData.name || userIssue.title,
        email: userData.email || '',
        avatar: avatar,
        status: userData.status || '🟢 В сети',
        isOnline: true
      } 
    });
    
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// 3. Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    
    // Валидация
    if (!username || !email || !password || !name) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Имя пользователя должно быть не менее 3 символов' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }
    
    // Проверяем, не занят ли username
    const usernameTaken = await isUsernameTaken(username);
    if (usernameTaken) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }
    
    // Проверяем email (простая проверка)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }
    
    // Создаем нового пользователя как GitHub Issue
    const userData = {
      email: email,
      password: password,
      name: name,
      status: '🟢 В сети',
      createdAt: new Date().toISOString(),
      contacts: [],
      settings: {}
    };
    
    const { data: newUser } = await octokit.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: username,
      body: `email:${email}\npassword:${password}\nname:${name}\nstatus:🟢 В сети\ncreatedAt:${new Date().toISOString()}\ndata:${JSON.stringify({
        contacts: [],
        settings: {}
      })}`,
      labels: ['user']
    });
    
    // Генерируем токен
    const token = jwt.sign(
      { 
        userId: newUser.number, 
        username: username,
        email: email
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Получаем аватар GitHub
    let avatar = null;
    try {
      const { data: ghUser } = await octokit.users.getByUsername({
        username: REPO_OWNER
      });
      avatar = ghUser.avatar_url;
    } catch (e) {
      console.log('Не удалось получить аватар GitHub');
    }
    
    res.json({ 
      token, 
      user: { 
        id: newUser.number.toString(),
        username: username,
        name: name,
        email: email,
        avatar: avatar,
        status: '🟢 В сети',
        isOnline: true
      } 
    });
    
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    
    // Более конкретные сообщения об ошибках
    if (error.status === 401) {
      return res.status(500).json({ error: 'Неверный GitHub токен. Проверьте GITHUB_TOKEN в .env' });
    }
    
    if (error.status === 404) {
      return res.status(500).json({ error: `Репозиторий ${REPO_OWNER}/${REPO_NAME} не найден` });
    }
    
    res.status(500).json({ error: `Ошибка сервера при регистрации: ${error.message}` });
  }
});

// 4. Проверка токена
app.post('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    
    // Верифицируем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Находим пользователя
    const userIssue = await findUserByUsername(decoded.username);
    
    if (!userIssue) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    // Парсим данные пользователя
    const bodyLines = userIssue.body.split('\n');
    const userData = {};
    
    bodyLines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        userData[key.trim()] = valueParts.join(':').trim();
      }
    });
    
    // Получаем аватар
    let avatar = null;
    if (userData.avatar) {
      avatar = userData.avatar;
    } else {
      try {
        const { data: ghUser } = await octokit.users.getByUsername({
          username: REPO_OWNER
        });
        avatar = ghUser.avatar_url;
      } catch (e) {
        console.log('Не удалось получить аватар GitHub');
      }
    }
    
    res.json({ 
      user: { 
        id: userIssue.number.toString(),
        username: userIssue.title,
        name: userData.name || userIssue.title,
        email: userData.email || '',
        avatar: avatar,
        status: userData.status || '🟢 В сети',
        isOnline: true
      } 
    });
    
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истек' });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при проверке токена' });
  }
});

// 5. Получение списка пользователей
app.get('/api/users', async (req, res) => {
  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: 'user',
      state: 'all',
      per_page: 100
    });
    
    const users = await Promise.all(issues.map(async (issue) => {
      // Парсим данные пользователя
      const bodyLines = issue.body.split('\n');
      const userData = {};
      
      bodyLines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          userData[key.trim()] = valueParts.join(':').trim();
        }
      });
      
      // Получаем аватар
      let avatar = null;
      if (userData.avatar) {
        avatar = userData.avatar;
      } else {
        try {
          const { data: ghUser } = await octokit.users.getByUsername({
            username: REPO_OWNER
          });
          avatar = ghUser.avatar_url;
        } catch (e) {
          console.log('Не удалось получить аватар GitHub');
        }
      }
      
      return {
        id: issue.number.toString(),
        username: issue.title,
        name: userData.name || issue.title,
        email: userData.email || '',
        avatar: avatar,
        status: userData.status || '🟢 В сети',
        isOnline: activeUsers.has(issue.number.toString())
      };
    }));
    
    res.json(users);
    
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка получения списка пользователей' });
  }
});

// 6. Получение конкретного пользователя
app.get('/api/users/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const userIssue = await findUserByUsername(username);
    
    if (!userIssue) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Парсим данные пользователя
    const bodyLines = userIssue.body.split('\n');
    const userData = {};
    
    bodyLines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        userData[key.trim()] = valueParts.join(':').trim();
      }
    });
    
    // Получаем аватар
    let avatar = null;
    if (userData.avatar) {
      avatar = userData.avatar;
    } else {
      try {
        const { data: ghUser } = await octokit.users.getByUsername({
          username: REPO_OWNER
        });
        avatar = ghUser.avatar_url;
      } catch (e) {
        console.log('Не удалось получить аватар GitHub');
      }
    }
    
    res.json({
      id: userIssue.number.toString(),
      username: userIssue.title,
      name: userData.name || userIssue.title,
      email: userData.email || '',
      avatar: avatar,
      status: userData.status || '🟢 В сети',
      isOnline: activeUsers.has(userIssue.number.toString())
    });
    
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
});

// 7. Сигнальный сервер для WebRTC
app.post('/api/calls/signal', async (req, res) => {
  try {
    const { from, to, signal, type } = req.body;
    
    if (!from || !to || !signal || !type) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    // Сохраняем сигнал в памяти для быстрого доступа
    if (!pendingCalls.has(to)) {
      pendingCalls.set(to, []);
    }
    pendingCalls.get(to).push({ from, signal, type, timestamp: Date.now() });
    
    // Очищаем старые сигналы (старше 30 секунд)
    const currentTime = Date.now();
    const cleanedSignals = pendingCalls.get(to).filter(
      s => currentTime - s.timestamp < 30000
    );
    pendingCalls.set(to, cleanedSignals);
    
    res.json({ success: true, message: 'Сигнал отправлен' });
    
  } catch (error) {
    console.error('Ошибка отправки сигнала:', error);
    res.status(500).json({ error: 'Ошибка отправки сигнала' });
  }
});

// 8. Получение сигналов (long-polling)
app.get('/api/calls/signals/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const timeout = 25000; // 25 секунд timeout
    
    const startTime = Date.now();
    
    // Функция проверки сигналов
    const checkForSignals = () => {
      const signals = pendingCalls.get(userId) || [];
      
      if (signals.length > 0) {
        // Возвращаем сигналы и очищаем
        pendingCalls.delete(userId);
        return res.json({ signals });
      }
      
      // Если время вышло
      if (Date.now() - startTime > timeout) {
        return res.json({ signals: [] });
      }
      
      // Ждем 500ms и проверяем снова
      setTimeout(checkForSignals, 500);
    };
    
    checkForSignals();
    
  } catch (error) {
    console.error('Ошибка получения сигналов:', error);
    res.status(500).json({ error: 'Ошибка получения сигналов' });
  }
});

// 9. Сохранение сообщений
app.post('/api/messages', async (req, res) => {
  try {
    const { from, to, text } = req.body;
    
    if (!from || !to || !text) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    // Создаем имя чата
    const chatName = `chat-${[from, to].sort().join('-')}`;
    
    // Ищем или создаем issue для чата
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'all',
      per_page: 100
    });
    
    let chatIssue = issues.find(issue => issue.title === chatName);
    
    if (!chatIssue) {
      const { data: newIssue } = await octokit.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: chatName,
        body: 'Chat history',
        labels: ['chat']
      });
      chatIssue = newIssue;
    }
    
    // Добавляем сообщение как комментарий
    const messageData = {
      from,
      to,
      text,
      timestamp: new Date().toISOString(),
      id: `msg_${Date.now()}`
    };
    
    await octokit.issues.createComment({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: chatIssue.number,
      body: JSON.stringify(messageData)
    });
    
    res.json({ success: true, message: messageData });
    
  } catch (error) {
    console.error('Ошибка сохранения сообщения:', error);
    res.status(500).json({ error: 'Ошибка сохранения сообщения' });
  }
});

// 10. Получение сообщений
app.get('/api/messages/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const chatName = `chat-${[user1, user2].sort().join('-')}`;
    
    // Ищем issue чата
    const { data: issues } = await octokit.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'all',
      per_page: 100
    });
    
    const chatIssue = issues.find(issue => issue.title === chatName);
    
    if (!chatIssue) {
      return res.json({ messages: [] });
    }
    
    // Получаем все комментарии
    const { data: comments } = await octokit.issues.listComments({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: chatIssue.number,
      per_page: 100
    });
    
    // Парсим сообщения
    const messages = comments
      .map(comment => {
        try {
          return JSON.parse(comment.body);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({ messages });
    
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Ошибка получения сообщений' });
  }
});

// 11. Обновление профиля
app.put('/api/users/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    
    // Верифицируем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, status } = req.body;
    
    // Находим пользователя
    const userIssue = await findUserByUsername(decoded.username);
    
    if (!userIssue) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Парсим текущие данные
    const bodyLines = userIssue.body.split('\n');
    const userData = {};
    
    bodyLines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        userData[key.trim()] = valueParts.join(':').trim();
      }
    });
    
    // Обновляем данные
    if (name) userData.name = name;
    if (status) userData.status = status;
    
    // Собираем обновленное тело
    let newBody = '';
    for (const [key, value] of Object.entries(userData)) {
      newBody += `${key}:${value}\n`;
    }
    
    // Обновляем issue
    await octokit.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: userIssue.number,
      body: newBody.trim()
    });
    
    // Получаем обновленного пользователя
    const updatedUser = {
      id: userIssue.number.toString(),
      username: userIssue.title,
      name: userData.name || userIssue.title,
      email: userData.email || '',
      avatar: userData.avatar || null,
      status: userData.status || '🟢 В сети',
      isOnline: true
    };
    
    res.json({ user: updatedUser });
    
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// 12. Обновление аватара
app.post('/api/users/avatar', async (req, res) => {
  try {
    // В реальном приложении здесь была бы загрузка файла
    // Для демонстрации просто возвращаем успех
    res.json({ 
      success: true, 
      message: 'Аватар обновлен (в демо-режиме)',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(req.body.name || 'User')}&background=0088cc&color=fff&size=128`
    });
    
  } catch (error) {
    console.error('Ошибка обновления аватара:', error);
    res.status(500).json({ error: 'Ошибка обновления аватара' });
  }
});

// ==================== ЗАПУСК СЕРВЕРА ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`🌐 GitHub репозиторий: ${REPO_OWNER}/${REPO_NAME}`);
  console.log(`🔗 API доступен по: http://localhost:${PORT}`);
  console.log(`🔗 Проверка здоровья: http://localhost:${PORT}/api/health`);
  
  // Проверяем соединение с GitHub
  await ensureRepoExists();
});

// ==================== ДЕМО-РЕЖИМ ====================
// Если GitHub токен не указан, запускаем в демо-режиме с локальными данными
if (!GITHUB_TOKEN || GITHUB_TOKEN === 'your_github_token_here') {
  console.warn('⚠️  ВНИМАНИЕ: GITHUB_TOKEN не указан!');
  console.warn('⚠️  Сервер будет работать в ДЕМО-РЕЖИМЕ с локальными данными');
  console.warn('⚠️  Для работы с GitHub создайте .env файл с GITHUB_TOKEN');
  
  // Переопределяем некоторые функции для демо-режима
  const demoUsers = [
    {
      id: '1',
      username: 'tihon',
      email: 'tihon@example.com',
      password: '2011',
      name: 'Тихон Метелкин',
      status: '🎧 Слушаю музыку',
      isOnline: true
    },
    {
      id: '2',
      username: 'olga',
      email: 'olga@example.com',
      password: '123456',
      name: 'Ольга Метелкина',
      status: '💼 На работе',
      isOnline: true
    },
    {
      id: '3',
      username: 'pavel',
      email: 'pavel@example.com',
      password: 'qwerty',
      name: 'Павел Вилков',
      status: '🏠 Дома',
      isOnline: false
    }
  ];
  
  // Переопределяем API методы для демо-режима
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = demoUsers.find(u => u.username === username && u.password === password);
    
    if (user) {
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      res.json({
        token,
        user: { ...user, password: undefined }
      });
    } else {
      res.status(401).json({ error: 'Неверный логин или пароль' });
    }
  });
  
  app.post('/api/auth/register', (req, res) => {
    const { username, email, password, name } = req.body;
    
    // Проверяем, не занят ли username
    if (demoUsers.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Имя пользователя уже занято' });
    }
    
    const newUser = {
      id: (demoUsers.length + 1).toString(),
      username,
      email,
      password,
      name,
      status: '🟢 В сети',
      isOnline: true,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0088cc&color=fff&size=128`
    };
    
    demoUsers.push(newUser);
    
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      token,
      user: { ...newUser, password: undefined }
    });
  });
  
  app.get('/api/users', (req, res) => {
    res.json(demoUsers.map(u => ({ ...u, password: undefined })));
  });
}
