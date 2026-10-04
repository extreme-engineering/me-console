// MeOS 品牌快照采集：从创作者后台（公众号/视频号/小红书）提取或手动录入指标，
// 同步到 MeOS /api/brand/snapshots（开发模式免鉴权）。

const BRAND_API = 'http://localhost:3001/api';
const MEOS_APP_URLS = [
  'http://localhost:3015',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://i76snwerw0t7.meoo.fun',
];
const BRAND_PLATFORMS = [
  { key: 'wechat-mp', label: '公众号' },
  { key: 'wechat-channels', label: '视频号' },
  { key: 'xiaohongshu', label: '小红书' },
];

// 复用 popup 的 token 中继：优先从已登录的 MeOS 标签页读 localStorage，回退 chrome.storage
function getToken(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && MEOS_APP_URLS.some((u) => tab.url.startsWith(u))) {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_MEOS_TOKEN' }, (res) => {
        cb(res && res.token ? res.token : null);
      });
      return;
    }
    chrome.storage.local.get(['meos_token'], (result) => cb(result.meos_token || null));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('brand-sync');
  if (!root) return;

  root.innerHTML = `
    <h3 style="font-size:14px;margin:0 0 8px;color:#1a1a1a;">品牌快照</h3>
    <select id="brand-platform" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:8px;">
      ${BRAND_PLATFORMS.map((p) => `<option value="${p.key}">${p.label}</option>`).join('')}
    </select>
    <button id="brand-extract" class="btn btn-secondary" style="width:100%;margin-bottom:8px;">从当前页提取（创作者后台）</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
      <input id="brand-followers" type="number" placeholder="粉丝（累计）" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;" />
      <input id="brand-views" type="number" placeholder="播放/阅读（累计）" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;" />
      <input id="brand-likes" type="number" placeholder="点赞（累计）" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;" />
      <input id="brand-comments" type="number" placeholder="评论（累计）" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;" />
      <input id="brand-shares" type="number" placeholder="分享（累计）" style="padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;" />
    </div>
    <button id="brand-sync" class="btn btn-primary" style="width:100%;">同步到 MeOS 快照</button>
    <div id="brand-status" style="margin-top:6px;font-size:12px;color:#10b981;min-height:16px;"></div>
  `;

  const $ = (id) => document.getElementById(id);
  const status = (msg, isError = false) => {
    const el = $('brand-status');
    el.textContent = msg;
    el.style.color = isError ? '#ef4444' : '#10b981';
  };

  $('brand-extract').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id || !/^https?:\/\//.test(tab.url || '')) {
        status('请在创作者后台页面使用此按钮', true);
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'GET_CREATOR_STATS' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.stats) {
          status('当前页没有采集脚本：请先打开公众号/视频号/小红书创作者后台', true);
          return;
        }
        if (res.platform) $('brand-platform').value = res.platform;
        if (res.stats.follower !== null) $('brand-followers').value = res.stats.follower;
        if (res.stats.views !== null) $('brand-views').value = res.stats.views;
        if (res.stats.likes !== null) $('brand-likes').value = res.stats.likes;
        if (res.stats.comments !== null) $('brand-comments').value = res.stats.comments;
        if (res.stats.shares !== null) $('brand-shares').value = res.stats.shares;
        status(`${res.stats.source || '已提取'}，请核对后同步`, false);
      });
    });
  });

  $('brand-sync').addEventListener('click', async () => {
    const followers = parseInt($('brand-followers').value, 10);
    if (!Number.isFinite(followers)) {
      status('粉丝数（累计）必填', true);
      return;
    }
    const platform = $('brand-platform').value;
    const payload = {
      followers,
      views: $('brand-views').value ? parseInt($('brand-views').value, 10) : null,
      likes: $('brand-likes').value ? parseInt($('brand-likes').value, 10) : null,
      comments: $('brand-comments').value ? parseInt($('brand-comments').value, 10) : null,
      shares: $('brand-shares').value ? parseInt($('brand-shares').value, 10) : null,
      note: `chrome 扩展采集：${platform}（${new Date().toISOString().slice(0, 10)}）`,
    };
    status('同步中…', false);
    try {
      const token = await new Promise((resolve) => getToken(resolve));
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const channelsRes = await fetch(`${BRAND_API}/brand/channels`, { headers });
      if (channelsRes.status === 401) {
        status('未登录：先打开 MeOS 页面登录一次，再同步', true);
        return;
      }
      if (!channelsRes.ok) throw new Error(`HTTP ${channelsRes.status}`);
      const { channels = [] } = await channelsRes.json();
      const matched = channels.filter((c) => c.platform === platform);
      if (matched.length === 0) {
        status('MeOS 里还没有该平台渠道：请先在品牌板块「渠道与数据」添加', true);
        return;
      }
      if (matched.length > 1) {
        status(`有 ${matched.length} 个同平台渠道：请在 MeOS 里指定（当前自动选第一个）`, false);
      }
      const channelId = matched[0].id;
      const snapRes = await fetch(`${BRAND_API}/brand/snapshots`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ channelId, ...payload }),
      });
      if (!snapRes.ok) {
        const text = await snapRes.text().catch(() => '');
        status(`同步失败（HTTP ${snapRes.status}）：${text.slice(0, 80)}`, true);
        return;
      }
      status('✅ 已写入品牌快照（在「数据仪表」查看趋势）');
      ['brand-followers', 'brand-views', 'brand-likes', 'brand-comments', 'brand-shares'].forEach((id) => {
        $(id).value = '';
      });
    } catch (err) {
      status(`同步失败：${err.message}（确认 MeOS 后端在 localhost:3001）`, true);
    }
  });
});
