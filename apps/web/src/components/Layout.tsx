import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { applyTheme, type Theme } from '../lib/theme';
import ToastContainer from './ToastContainer';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  prominent?: boolean;
}

const navItems: NavItem[] = [
  { label: '今日', path: '/', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', prominent: true },
  { label: '工作台', path: '/workbench', icon: 'M4 4h6v6H4V4zm10 0h6v3h-6V4zm0 6h6v10h-6V10zM4 14h6v6H4v-6z', prominent: true },
  {
    label: '方向',
    path: '/direction',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  },
  {
    label: '行动',
    path: '/action',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    label: '认知',
    path: '/cognition',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  {
    label: '反思',
    path: '/reflection',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  },
  {
    label: '资源',
    path: '/resources',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    label: 'MeLog',
    path: '/melog',
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
  },
  {
    label: '品牌',
    path: '/brand',
    icon: 'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  },
  {
    label: '商机',
    path: '/opportunity',
    icon: 'M3 17l6-6 4 4 8-8m0 0h-6m6 0v6',
  },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    (document.documentElement.dataset.theme as Theme) || 'light'
  );
  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const navLink = (active: boolean, prominent = false) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
      active
        ? prominent
          ? 'bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] shadow-sm'
          : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
        : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]'
    }`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Mobile Header */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border-light)',
        }}
      >
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          MeOS
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label={sidebarOpen ? '关闭菜单' : '打开菜单'}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-56 flex flex-col
          transform transition-transform duration-200 ease-out
          md:translate-x-0 md:static md:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border-light)',
        }}
      >
        {/* Logo */}
        <div
          className="h-14 flex items-center justify-between px-5"
          style={{ borderBottom: '1px solid var(--color-border-light)' }}
        >
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            onClick={() => setSidebarOpen(false)}
          >
            MeOS
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-slate-100 rounded"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={navLink(active, item.prominent)}
                  onClick={() => setSidebarOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div
          className="px-5 py-4"
          style={{ borderTop: '1px solid var(--color-border-light)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-ink-soft)' }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {user?.name || '用户'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                {user?.email || 'me@meos.app'}
              </p>
            </div>
            <button
              onClick={() => {
                const next: Theme = theme === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                setTheme(next);
              }}
              className="p-1.5 rounded hover:bg-slate-100 transition-colors"
              title={theme === 'dark' ? '切换到白色模式' : '切换到深夜模式'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-slate-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded hover:bg-slate-100 transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-12 pt-16 md:pt-10">
          <Outlet />
        </div>
      </main>

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}