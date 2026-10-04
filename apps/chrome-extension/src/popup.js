// MeOS Chrome Extension - Popup Script

const MEOS_APP_URLS = [
  'http://localhost:3015',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://i76snwerw0t7.meoo.fun',
];
const API_BASE = 'http://localhost:3001/api';
const APP_URL = 'https://i76snwerw0t7.meoo.fun';

document.addEventListener('DOMContentLoaded', () => {
  const statsContainer = document.getElementById('stats');
  const openBtn = document.getElementById('open-meos');
  const quickAddBtn = document.getElementById('quick-add');
  const todoInput = document.getElementById('todo-title');
  const todoStatus = document.getElementById('todo-status');

  // Default stats
  let stats = {
    todosToday: 0,
    goalsActive: 0,
    reflectionStreak: 0
  };

  // Load stats from storage
  chrome.storage.local.get(['meos_stats'], (result) => {
    if (result.meos_stats) {
      stats = result.meos_stats;
      renderStats();
    }
  });

  function renderStats() {
    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.todosToday}</div>
        <div class="stat-label">今日待办</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.goalsActive}</div>
        <div class="stat-label">进行中目标</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.reflectionStreak}</div>
        <div class="stat-label">反思连续天数</div>
      </div>
    `;
  }

  function setStatus(message, isError) {
    todoStatus.textContent = message;
    todoStatus.className = 'todo-status' + (isError ? ' error' : '');
  }

  function getToken(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && MEOS_APP_URLS.some((u) => tab.url.startsWith(u))) {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_MEOS_TOKEN' }, (res) => {
          if (res && res.token) return cb(res.token);
          cb(null);
        });
        return;
      }
      chrome.storage.local.get(['meos_token'], (result) => cb(result.meos_token || null));
    });
  }

  function createTodo(title) {
    setStatus('添加中…', false);
    getToken((token) => {
      if (!token) {
        setStatus('未登录：先打开一次 MeOS 页面并登录，再试', true);
        return;
      }
      fetch(`${API_BASE}/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, source: 'extension' }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setStatus('已添加 ✓', false);
          todoInput.value = '';
        })
        .catch(() => {
          setStatus('添加失败，请确认后端已启动（localhost:3001）', true);
        });
    });
  }

  openBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: APP_URL });
  });

  quickAddBtn.addEventListener('click', () => {
    const title = todoInput.value.trim();
    if (!title) {
      todoInput.focus();
      return;
    }
    createTodo(title);
  });

  todoInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const title = todoInput.value.trim();
    if (!title) return;
    createTodo(title);
  });
});