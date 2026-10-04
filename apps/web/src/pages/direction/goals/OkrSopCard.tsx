import { useState } from 'react';
import { ChevronDown, ClipboardList } from 'lucide-react';
import MarkdownDoc from '../../../components/MarkdownDoc';
import {
  canSave,
  getOkrMd,
  saveOkrDoc,
  setOkrMd,
  toggleTaskAtLine,
  useOkrMd,
} from '../../../lib/okrDoc';
import { toast } from '../../../stores/toastStore';

export default function OkrSopCard() {
  const [expanded, setExpanded] = useState(false);
  const okrMd = useOkrMd();

  const handleToggleTask = (line: number) => {
    const previous = okrMd;
    const next = toggleTaskAtLine(okrMd, line);
    if (!next) return;
    setOkrMd(next);
    saveOkrDoc(next).catch(() => {
      // 只在内容仍是本次失败版本时回滚，避免覆盖之后已成功的勾选
      if (getOkrMd() === next) setOkrMd(previous);
      toast.error('保存失败：仅本地开发（vite dev）支持写回文件');
    });
  };

  return (
    <div className="mb-6 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <ClipboardList size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
          2026-10 OKR &amp; SOP
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          · 月度作战计划（2 目标 · 7 KR · 日历拆解 + 责任人 / 依赖 / 风险预案）
        </span>
        <ChevronDown
          size={14}
          className="ml-auto transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', color: 'var(--color-text-tertiary)', flexShrink: 0 }}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
            源文件 docs/目标/2026-10-OPC-OKR.md；可在「方向 → OKR 文档」在线编辑，勾选即时保存（生产构建只读）
          </div>
          <MarkdownDoc md={okrMd} onToggleTask={canSave ? handleToggleTask : undefined} />
        </div>
      )}
    </div>
  );
}