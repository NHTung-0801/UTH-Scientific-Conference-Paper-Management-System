// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// import './assets/styles/index.css'; // Bỏ comment dòng này nếu bạn đã tạo file CSS

// Tìm thẻ div root trong public/index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render ứng dụng
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);