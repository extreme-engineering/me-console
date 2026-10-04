import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Save, TriangleAlert } from 'lucide-react';
import MarkdownDoc from '../../components/MarkdownDoc';
import { canSave, saveOkrDoc, setOkrMd, toggleTaskAtLine, useOkrMd } from '../../lib/okrDoc';
import { toast } from '../../stores/toastStore';

const SAVED_TOAST = '已保存到 docs/目标/2026-10-OPC-OKR.md';

export default function OkrDoc() {
  const fileMd = useOkrMd();
  const [draft, setDraft] = useState(fileMd);
  const [baseline, setBaseline] = useState(fileMd);
  const [externalUpdate, setExternalUpdate] = useState(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const saving = pendingSaves > 0;
  const dirty = draft !== baseline;

  // 源文件被外部改动（HMR 带回新 ?raw）时：没有本地修改就自动采纳，否则提示
  useEffect(() => {
    if (fileMd === baseline) return;
    if (draft === baseline) {
      setDraft(fileMd);
      setBaseline(fileMd);
      setExternalUpdate(false);
    } else {
      setExternalUpdate(true);
    }
  }, [fileMd, draft, baseline]);

  const persist = useCallback((content: string, options?: { silent?: boolean }) => {
    if (!canSave) return;
    setPendingSaves((count) => count + 1);
    saveOkrDoc(content)
      .then(() => {
        setOkrMd(content);
        setBaseline(content);
        if (!options?.silent) toast.success(SAVED_TOAST);
      })
      .catch(() => {
        toast.error('保存失败：仅本地开发（vite dev）支持写回文件');
      })
      .finally(() => setPendingSaves((count) => count - 1));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty && canSave) persist(draft);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirty, draft, persist]);

  const handleToggleTask = (line: number) => {
    const next = toggleTaskAtLine(draft, line);
    if (!next) return;
    setDraft(next);
    persist(next, { silent: true });
  };

  const handleRestore = () => setDraft(baseline);

  const handleAdopt = () => {
    setDraft(fileMd);
    setBaseline(fileMd);
    setExternalUpdate(false);
  };

  const statusText = !canSave ? '只读（生产构建）' : dirty ? '有未保存修改' : '已保存';

  return (
    <div className="page-enter">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="text-xl mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
            }}
          >
            OKR &amp; SOP 文档
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            在线编辑 docs/目标/2026-10-OPC-OKR.md —— 保存写回源文件，勾选 checklist 自动保存
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs mr-1"
            style={{ color: dirty ? '#EA580C' : 'var(--color-text-tertiary)' }}
          >
            {saving ? '保存中…' : statusText}
          </span>
          <button
            onClick={handleRestore}
            disabled={!canSave || !dirty}
            className="btn btn-ghost"
            title="放弃未保存的修改"
          >
            <RotateCcw size={14} />
            恢复
          </button>
          <button
            onClick={() => persist(draft)}
            disabled={!canSave || !dirty || saving}
            className="btn btn-primary"
            title="保存（⌘/Ctrl+S）"
          >
            <Save size={14} />
            保存
          </button>
        </div>
      </div>

      {externalUpdate && (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg px-4 py-2.5 text-xs"
          style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
        >
          <TriangleAlert size={14} className="flex-shrink-0" />
          源文件已在外部更新，当前编辑内容会在保存时覆盖它
          <button onClick={handleAdopt} className="underline">
            载入最新
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          readOnly={!canSave}
          spellCheck={false}
          aria-label="OKR markdown 编辑器"
          className="input font-mono text-xs leading-relaxed resize-none h-[70vh] p-4"
        />
        <div
          className="card p-6 h-[70vh] overflow-auto"
          aria-label="markdown 预览"
        >
          <MarkdownDoc md={draft} onToggleTask={canSave ? handleToggleTask : undefined} />
        </div>
      </div>

      {!canSave && (
        <p className="mt-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          生产构建中文件是内联只读内容，保存仅在本地开发（vite dev）可用。
        </p>
      )}
    </div>
  );
}