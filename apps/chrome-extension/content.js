// MeOS Chrome Extension Content Script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_MEOS_TOKEN') {
    // zustand persist 把 token 存在页面的 localStorage（键 meos-auth）里
    try {
      const raw = localStorage.getItem('meos-auth');
      const parsed = raw ? JSON.parse(raw) : null;
      sendResponse({ token: parsed?.state?.token || null });
    } catch {
      sendResponse({ token: null });
    }
    return true;
  }

  return true;
});
// ============ 创作者后台指标采集（启发式，需按各平台后台实测校准） ============

const CREATOR_PATTERNS = {
  follower: /(粉丝|关注用户|关注数?|订阅)\s*[：: ]?\s*([\d,]+(?:\.\d+)?[万wW]?)/,
  views: /(阅读次数?|阅读|总阅读|播放量?|播放|曝光量?)\s*[：: ]?\s*([\d,]+(?:\.\d+)?[万wW]?)/,
  likes: /(获赞与收藏|获赞|点赞|在看)\s*[：: ]?\s*([\d,]+(?:\.\d+)?[万wW]?)/,
  comments: /(评论数?|评论)\s*[：: ]?\s*([\d,]+(?:\.\d+)?[万wW]?)/,
  shares: /(分享数?|转发数?|分享|转发)\s*[：: ]?\s*([\d,]+(?:\.\d+)?[万wW]?)/,
};

function parseCnNumber(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  const match = cleaned.match(/^([\d.]+)([万wW]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return null;
  return /^[万wW]$/.test(match[2]) ? Math.round(num * 10000) : Math.round(num);
}

// 从页面可见文本中启发式抽取粉丝/阅读/点赞/评论/分享（可能误报，交由用户在 popup 核对后同步）
function extractCreatorStats() {
  const text = document.body ? document.body.innerText : '';
  const lines = text.split('\n').filter((l) => l.trim().length > 0 && l.trim().length < 80);
  const stats = { follower: null, views: null, likes: null, comments: null, shares: null, source: '启发式抽取（请核对）' };
  for (const line of lines) {
    for (const [key, re] of Object.entries(CREATOR_PATTERNS)) {
      if (stats[key] !== null) continue;
      const m = line.match(re);
      if (m) {
        const v = parseCnNumber(m[2]);
        if (v !== null && v > 0) stats[key] = v;
      }
    }
  }
  return { url: location.href, platform: detectCreatorPlatform(location.href), stats };
}

function detectCreatorPlatform(url) {
  if (url.includes('mp.weixin.qq.com')) return 'wechat-mp';
  if (url.includes('channels.weixin.qq.com')) return 'wechat-channels';
  if (url.includes('creator.xiaohongshu.com')) return 'xiaohongshu';
  // MeOS 自身页面不被识别为创作者后台
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CREATOR_STATS') {
    const result = extractCreatorStats();
    sendResponse(result);
    return true;
  }
  return true;
});
