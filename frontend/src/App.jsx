import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import API from './services/api';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      API.get('/users/me').then(res => setUser(res.data)).catch(() => {
        localStorage.removeItem('token');
      });
    }
  }, []);

  const handleLogin = async () => {
    const username = prompt('Enter username:');
    const asDev = confirm('Log in as developer?');
    let pwd = '';
    if (asDev) pwd = prompt('Enter developer password:');
    const res = await API.post('/auth/login', { username, asDev, pwd });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  if (!user) return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h2>GitChat — Messenger for Developers</h2>
      <button onClick={handleLogin}>Login</button>
    </div>
  );

  return (
    <div className="twitter-layout">
      <Sidebar />
      <Feed />
      <div style={{ width: 300, padding: 20 }}>
        <h3>Channels</h3>
        <div>• General</div>
        <div>• Dev Talk</div>
        <div>• Help</div>
      </div>
    </div>
  );
}

export default App;
