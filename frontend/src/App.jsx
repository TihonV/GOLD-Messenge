import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import API from './services/api';

const socket = io('http://localhost:5000');

export default function App() {
  const [user, setUser] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      API.get('/users/me').then(res => setUser(res.data));
    }

    socket.on('message', (msg) => {
      if (activeChat && (msg.sender === activeChat._id || msg.recipient === activeChat._id)) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      socket.off('message');
    };
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    const username = prompt('Имя пользователя:');
    if (!username) return;
    const isDev = confirm('Войти как разработчик?');
    let pwd = '';
    if (isDev) pwd = prompt('Пароль:');
    try {
      const res = await API.post('/auth/login', { username, pwd });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка входа');
    }
  };

  const handleRegister = async () => {
    const username = prompt('Имя пользователя:');
    const name = prompt('Ваше имя:');
    if (!username || !name) return;
    try {
      const res = await API.post('/auth/register', { username, name });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка регистрации');
    }
  };

  const loadChatHistory = async (otherUser) => {
    setActiveChat(otherUser);
    try {
      const res = await API.get(`/chats/history/${otherUser._id}`);
      setMessages(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeChat) return;
    const msg = { recipientId: activeChat._id, content: newMsg };
    try {
      await API.post('/chats/message', msg);
      setMessages(prev => [...prev, { ...msg, sender: user._id, timestamp: new Date().toISOString() }]);
      setNewMsg('');
    } catch (e) {
      alert('Не удалось отправить');
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await API.get(`/users?search=${searchQuery}`);
      setSearchResults(res.data);
    } catch (e) {
      setSearchResults([]);
    }
  };

  const startVideoCall = () => {
    setIsVideoOpen(true);
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <h2>Myteam</h2>
        <button onClick={handleLogin}>Войти</button>
        <button onClick={handleRegister}>Зарегистрироваться</button>
        <p><small>Админ: логин = tihon, пароль = 2011</small></p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 360px', height: '100vh' }}>
      {/* Левая панель — чаты */}
      <div style={{ borderRight: '1px solid #eee', backgroundColor: '#fff', overflowY: 'auto' }}>
        <div style={{ padding: '16px', fontWeight: 'bold', fontSize: '18px' }}>Чаты</div>
        <div style={{ padding: '0 8px' }}>
          {['Саша', 'Анна', 'Ирина'].map((name, i) => (
            <div
              key={i}
              onClick={() => loadChatHistory({ _id: i.toString(), name, avatar: '/images/fron.jpg' })}
              style={{
                display: 'flex',
                padding: '12px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                backgroundColor: activeChat?._id === i.toString() ? '#eef7ff' : ''
              }}
            >
              <img src="/images/fron.jpg" width="40" height="40" style={{ borderRadius: '50%', marginRight: 12 }} />
              <div>
                <div>{name}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>Плюс к концу недели...</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Центральная панель — переписка */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {activeChat ? (
          <>
            <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
              <img src={activeChat.avatar} width="40" height="40" style={{ borderRadius: '50%', marginRight: 12 }} />
              <div>
                <div>
                  <strong>{activeChat.name}</strong>
                  {activeChat.isVerified && <img src="/images/verified.png" width="16" alt="✓" style={{ marginLeft: '4px' }} />}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>Online</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button onClick={startVideoCall} style={{ background: '#1DA1F2', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px' }}>📞</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: '16px', textAlign: m.sender === user._id ? 'right' : 'left' }}>
                  {m.sender !== user._id && (
                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                      <strong>{activeChat.name}</strong>
                    </div>
                  )}
                  <div style={{
                    display: 'inline-block',
                    maxWidth: '70%',
                    padding: '8px 12px',
                    borderRadius: '18px',
                    background: m.sender === user._id ? '#e6f7ff' : '#ffffff',
                    border: '1px solid #eee'
                  }}>
                    {m.content}
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: '12px', borderTop: '1px solid #eee', display: 'flex' }}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="Сообщение"
                style={{ flex: 1, padding: '8px', borderRadius: '20px', border: '1px solid #ddd' }}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage} style={{ marginLeft: '8px', background: '#1DA1F2', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px' }}>
                ➡️
              </button>
            </div>
          </>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            Выберите чат слева
          </div>
        )}
      </div>

      {/* Правая панель — поиск */}
      <div style={{ backgroundColor: '#fafafa', padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск пользователей..."
            style={{ width: '100%', padding: '10px', borderRadius: '20px', border: '1px solid #ddd' }}
            onKeyPress={e => e.key === 'Enter' && searchUsers()}
          />
          <button onClick={searchUsers} style={{ marginTop: '8px', width: '100%', padding: '6px', background: '#1DA1F2', color: 'white', border: 'none', borderRadius: '4px' }}>
            Найти
          </button>
        </div>
        <div>
          {searchResults.map(u => (
            <div key={u._id} style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src={u.avatar} width="36" height="36" style={{ borderRadius: '50%', marginRight: 12 }} />
                <div>
                  <div>
                    <strong>{u.name}</strong>
                    {u.isVerified && <img src="/images/verified.png" width="14" alt="✓" style={{ marginLeft: '4px' }} />}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>@{u.username}</div>
                </div>
              </div>
              <button onClick={() => loadChatHistory(u)} style={{ marginTop: '8px', width: '100%', padding: '6px', background: '#1DA1F2', color: 'white', border: 'none', borderRadius: '4px' }}>
                Написать
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Видеозвонок */}
      {isVideoOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
            <h3>Видеозвонок с {activeChat?.name}</h3>
            <video autoPlay muted style={{ width: '320px', height: '240px', background: '#000', margin: '10px' }} />
            <video autoPlay style={{ width: '320px', height: '240px', background: '#000', margin: '10px' }} />
            <br/>
            <button onClick={() => setIsVideoOpen(false)} style={{ background: 'red', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '4px' }}>
              Завершить звонок
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
