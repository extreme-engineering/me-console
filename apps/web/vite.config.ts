import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// 「方向 → OKR 文档」编辑页的保存接口：把 POST 内容写回仓库源文件。
// 固定白名单路径，绝不接受请求指定的路径；仅 dev server（apply: 'serve'）注册。
const OKR_DOC_URL = '/__okr-doc/2026-10-OPC-OKR.md';
const OKR_DOC_FILE = path.resolve(__dirname, '../../docs/目标/2026-10-OPC-OKR.md');
const MAX_OKR_BODY = 1024 * 1024;

// dev server 绑定 0.0.0.0，写接口只允许本机访问，避免局域网内改写文档
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function okrDocSavePlugin(): Plugin {
  return {
    name: 'meos-okr-doc-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== OKR_DOC_URL) return next();

        const send = (status: number, payload: Record<string, unknown>) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(payload));
        };

        if (req.method !== 'POST') return send(405, { ok: false, error: 'method not allowed' });
        if (!LOCAL_HOST_RE.test(req.headers.host ?? ''))
          return send(403, { ok: false, error: 'local host only' });
        if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('text/plain'))
          return send(415, { ok: false, error: 'content-type must be text/plain' });

        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
          if (res.writableEnded) return;
          size += chunk.length;
          if (size > MAX_OKR_BODY) {
            send(413, { ok: false, error: 'payload too large' });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => {
          if (res.writableEnded) return;
          const body = Buffer.concat(chunks).toString('utf8');
          // ?raw 产物已注册在模块图中，watcher 会自动传播 HMR；add 是幂等保险
          server.watcher.add(OKR_DOC_FILE);
          fs.writeFile(OKR_DOC_FILE, body, 'utf8', (error) => {
            if (error) return send(500, { ok: false, error: error.message });
            send(200, { ok: true });
          });
        });
      });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.MEOO_PROXY_TARGET;

  return {
    // Local credentials are only defined for the dev server, never for publish builds.
    define: { 'import.meta.env.MEOO_LOCAL_ANON_KEY': JSON.stringify(command === 'serve' ? env.SUPABASE_ANON_KEY || '' : '') },
    plugins: [react(), okrDocSavePlugin()],
    base: './',
    server: {
      port: 3015,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
          '/sb-api': {
            target: proxyTarget,
            changeOrigin: true,
            secure: true,
            ws: true,
            rewrite: (requestPath: string) => requestPath.replace(/^\/sb-api(?=\/|\?|$)/, ''),
            headers: { 'X-Meoo-Source': 'local-dev', 'OneDay-App-Id': env.MEOO_PROJECT_URL_ID },
          },
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      assetsInlineLimit: 1024 * 1024,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-data': ['axios', 'zustand'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
