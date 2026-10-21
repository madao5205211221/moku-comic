import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// 渲染前先把主题挂上，避免启动时闪一下默认配色
try {
  const saved = JSON.parse(localStorage.getItem('moku.settings.v1') || '{}')
  document.documentElement.dataset.theme = saved.theme || 'ink'
} catch {
  document.documentElement.dataset.theme = 'ink'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
