import React, { useState, useEffect } from 'react';
import API from '../services/api';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    API.get('/posts').then(res => setPosts(res.data));
  }, []);

  const handlePost = async () => {
    if (!content.trim()) return;
    const res = await API.post('/posts', { content });
    setPosts([res.data, ...posts]);
    setContent('');
  };

  return (
    <div style={{ flex: 1, borderRight: '1px solid #e1e8ed' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e1e8ed' }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What's happening?"
          style={{ width: '100%', height: 80, padding: 12, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <button onClick={handlePost} style={{
          marginTop: 8,
          backgroundColor: '#1DA1F2',
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '8px 24px'
        }}>Post</button>
      </div>
      <div>
        {posts.map(post => (
          <div key={post._id} style={{ padding: '16px', borderBottom: '1px solid #e1e8ed' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img src={post.user.avatar} width="40" height="40" style={{ borderRadius: '50%', marginRight: 12 }} />
              <div>
                <strong>{post.user.name}</strong>
                {post.user.isGold && <img src="/svg/verified.svg" width="16" height="16" style={{ marginLeft: 4 }} />}
                <div>@{post.user.username}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>{post.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
