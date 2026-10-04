import { useState } from 'react';
import { BookOpenText, ChevronDown, Compass, AlertTriangle, ListChecks, StickyNote, MousePointerClick, CheckCircle2 } from 'lucide-react';
import { METHODOLOGY } from '../lib/methodology';

const READ_KEY = 'meos:methodology-read';
const INK3 = 'var(--color-ink-3)';
const INK2 = 'var(--color-ink-2)';
const INK = 'var(--color-ink)';
const PAPER2 = 'var(--color-paper-2)';
const SURFACE = 'var(--color-surface)';
const BORDER_LIGHT = 'var(--color-border-light)';

function getReadSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markRead(page: string) {
  const set = getReadSet();
  set.add(page);
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

function Section({ icon: Icon, label, children }: { icon: typeof Compass; label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} style={{ color: INK3, flexShrink: 0 }} />
        <span className="text-xs font-semibold tracking-wide" style={{ color: INK2 }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function MethodologyCard({ page }: { page: string }) {
  const [collapsed, setCollapsed] = useState(true);
  const [deep, setDeep] = useState(false);
  const [read, setRead] = useState(() => getReadSet().has(page));
  const entry = METHODOLOGY[page];
  if (!entry) return null;

  const hasDeep = !!(entry.background || entry.guide?.length || entry.pitfalls?.length || entry.notes?.length || entry.practice);
  const panelId = `methodology-panel-${page.replace(/[^a-z0-9]/gi, '-')}`;
  const deepId = `methodology-deep-${page.replace(/[^a-z0-9]/gi, '-')}`;

  const handleExpand = () => {
    setCollapsed(!collapsed);
    if (collapsed && !read) {
      markRead(page);
      setRead(true);
    }
  };

  return (
    <div className="mb-6 rounded-xl" style={{ backgroundColor: PAPER2 }}>
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        id={`methodology-toggle-${page.replace(/[^a-z0-9]/gi, '-')}`}
      >
        <BookOpenText size={14} style={{ color: INK3, flexShrink: 0 }} />
        <span className="text-xs font-medium tracking-wide" style={{ color: INK2 }}>
          方法论与指导思想
        </span>
        <span className="text-xs" style={{ color: INK3 }}>
          · {entry.title}
        </span>
        {read && (
          <CheckCircle2 size={12} style={{ color: INK3, flexShrink: 0 }} aria-label="已读" />
        )}
        <ChevronDown
          size={14}
          className="ml-auto transition-transform"
          style={{ transform: collapsed ? 'none' : 'rotate(180deg)', color: INK3, flexShrink: 0 }}
        />
      </button>

      {!collapsed && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={`methodology-toggle-${page.replace(/[^a-z0-9]/gi, '-')}`}
          className="px-4 pb-4"
        >
          <p className="text-sm mb-2.5" style={{ color: INK, lineHeight: 1.7 }}>
            {entry.philosophy}
          </p>
          <ul className="space-y-1.5">
            {entry.principles.map((principle) => (
              <li key={principle} className="flex gap-2 text-sm" style={{ color: INK2, lineHeight: 1.6 }}>
                <span style={{ color: INK3, flexShrink: 0 }}>—</span>
                <span>{principle}</span>
              </li>
            ))}
          </ul>

          {hasDeep && !deep && (
            <button
              onClick={() => setDeep(true)}
              className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: INK2, backgroundColor: SURFACE, border: `1px solid ${BORDER_LIGHT}` }}
              aria-expanded={deep}
              aria-controls={deepId}
            >
              深入阅读：背景 · 指引 · 陷阱 · 实践
            </button>
          )}

          {hasDeep && deep && (
            <div
              id={deepId}
              role="region"
              aria-label="深入阅读内容"
              className="mt-4 pt-4"
              style={{ borderTop: `1px solid ${BORDER_LIGHT}` }}
            >
              {entry.background && (
                <Section icon={Compass} label="背景与为什么">
                  <p className="text-sm" style={{ color: INK2, lineHeight: 1.7 }}>{entry.background}</p>
                </Section>
              )}

              {entry.guide && entry.guide.length > 0 && (
                <Section icon={ListChecks} label="操作指引">
                  <ol className="space-y-1.5 list-decimal list-inside">
                    {entry.guide.map((step) => (
                      <li key={step} className="text-sm" style={{ color: INK2, lineHeight: 1.6 }}>{step}</li>
                    ))}
                  </ol>
                </Section>
              )}

              {entry.pitfalls && entry.pitfalls.length > 0 && (
                <Section icon={AlertTriangle} label="常见陷阱">
                  <div className="space-y-2">
                    {entry.pitfalls.map((p) => (
                      <div key={p.trap} className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER_LIGHT}` }}>
                        <span style={{ color: INK }}>{p.trap}</span>
                        <span style={{ color: INK3 }}> → </span>
                        <span style={{ color: INK2 }}>{p.remedy}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {entry.notes && entry.notes.length > 0 && (
                <Section icon={StickyNote} label="注意事项">
                  <ul className="space-y-1.5">
                    {entry.notes.map((note) => (
                      <li key={note} className="flex gap-2 text-sm" style={{ color: INK2, lineHeight: 1.6 }}>
                        <span style={{ color: INK3, flexShrink: 0 }}>·</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {entry.practice && (
                <Section icon={MousePointerClick} label="在 MeOS 中实践">
                  <p className="text-sm" style={{ color: INK2, lineHeight: 1.7 }}>{entry.practice}</p>
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
