import React from 'react';

const navItems = [
  { icon: '/svg/home.svg', label: 'Home' },
  { icon: '/svg/explore.svg', label: 'Explore' },
  { icon: '/svg/notifications.svg', label: 'Notifications' },
  { icon: '/svg/messages.svg', label: 'Messages' },
  { icon: '/svg/profile.svg', label: 'Profile' },
];

export default function Sidebar() {
  return (
    <div style={{ width: 260, backgroundColor: '#fff', borderRight: '1px solid #e1e8ed', padding: '20px 0' }}>
      <div style={{ fontSize: 32, fontWeight: 'bold', margin: '0 20px 30px' }}>GitChat</div>
      {navItems.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer' }}>
          <img src={item.icon} alt="" width="24" height="24" style={{ marginRight: 16 }} />
          <span>{item.label}</span>
        </div>
      ))}
      <button style={{
        margin: '20px',
        backgroundColor: '#1DA1F2',
        color: 'white',
        border: 'none',
        borderRadius: 30,
        padding: '12px 24px',
        fontWeight: 'bold',
        cursor: 'pointer',
        width: 'calc(100% - 40px)'
      }}>New Post</button>
    </div>
  );
}
