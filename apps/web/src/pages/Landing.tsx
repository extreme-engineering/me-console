import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Github, ArrowRight, Layers, ShieldCheck } from 'lucide-react';
import Today from './Today';
import GtmSections from '../components/GtmSections';
import { useLocalMode } from '../lib/api';
import { ensureDemoAccount, DEMO_EMAIL } from '../lib/demoSeed';
import { useAuthStore } from '../stores/authStore';

export default function Landing() {
  const { user, isAuthenticated, setAuth } = useAuthStore();
  const [bootstrapState, setBootstrapState] = useState<'pending' | 'done' | 'failed'>('pending');
  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_SKIP_AUTH === 'true';

  // 仅挂载时执行一次：demo 账号引导，重复执行会重置已完成的登录态
  useEffect(() => {
    if (!useLocalMode || isDevMode) {
      setBootstrapState('done');
      return;
    }
    let cancelled = false;
    (async () => {
      if (isAuthenticated) {
        await useAuthStore.getState().initFromStorage();
        if (!cancelled) setBootstrapState('done');
        return;
      }
      try {
        const res = await ensureDemoAccount();
        if (!cancelled) {
          setAuth(res.user, res.token);
          setBootstrapState('done');
        }
      } catch {
        if (!cancelled) setBootstrapState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!useLocalMode && !isAuthenticated && !isDevMode) {
    return <Navigate to="/login" replace />;
  }

  const ready = (isAuthenticated || isDevMode) && bootstrapState === 'done';
  const isDemo = user?.email === DEMO_EMAIL;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-10 h-14 flex items-center justify-between px-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border-light)',
        }}
      >
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          MeOS
        </span>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/allengaller/me-os"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          {ready && !isDemo && user && (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              {user.name}
            </span>
          )}
          <Link to="/login" className="text-sm text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition-colors">
            登录
          </Link>
          <Link
            to="/register"
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-text-primary)' }}
          >
            注册
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-14 pb-10 text-center">
        <p
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full mb-5"
          style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
        >
          <Layers className="w-3.5 h-3.5" />
          开源 · 本地优先 · MCP 原生
        </p>
        <h1
          className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          把你的生活数据，
          <br className="md:hidden" />
          变成你拥有的操作系统
        </h1>
        <p className="text-sm md:text-base leading-relaxed" style={{ color: 'var(--color-ink-2)' }}>
          健康、笔记、聊天记录汇入本地时间线；五维方法论内置；通过 MCP 让 AI 读写你的数据。
          下方就是真实运行的产品 —— 无需注册，直接开始。
        </p>
      </section>

      {/* Embedded product */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-6">
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border-light)' }}>
          <div
            className="h-11 flex items-center justify-between px-5"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border-light)',
            }}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              立即体验 · 无需注册 · 数据仅保存在此浏览器，不上传任何服务器
            </span>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            </div>
          </div>
          <div className="max-h-[720px] overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
            {ready ? (
              <Today />
            ) : bootstrapState === 'failed' ? (
              <div className="py-20 text-center text-sm" style={{ color: 'var(--color-ink-2)' }}>
                访客身份创建失败，
                <Link to="/register" className="underline mx-1" style={{ color: 'var(--color-accent)' }}>
                  注册一个账号
                </Link>
                再开始
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <div className="w-5 h-5 border border-slate-200 border-t-slate-900 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </section>

      <GtmSections />

      {/* Footer */}
      <footer
        className="py-8 px-6 text-center text-xs"
        style={{
          borderTop: '1px solid var(--color-border-light)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <p className="mb-1.5">
          MIT License · Build in Public ·
          <a
            href="https://github.com/allengaller/me-os"
            target="_blank"
            rel="noreferrer"
            className="hover:underline ml-1"
            style={{ color: 'var(--color-accent)' }}
          >
            github.com/allengaller/me-os
          </a>
        </p>
        <p>
          你的所有数据仅保存在当前设备的浏览器中（IndexedDB），不会上传到任何服务器；清除浏览器数据会删除全部记录。
        </p>
      </footer>
    </div>
  );
}
