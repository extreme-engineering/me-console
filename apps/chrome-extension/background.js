// MeOS Chrome Extension Background Service Worker

const APP_URL = 'https://i76snwerw0t7.meoo.fun';

// 首次安装引导：直接打开 MeOS
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: APP_URL });
  }
});
