import { useMemo, useState } from 'react';
import type { InsightNote } from '@meos/shared';
import { Plus, Lightbulb, Clock } from 'lucide-react';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { toast } from '../../stores/toastStore';

// /insights 在本地/远端模式下可能返回数组或 { insights: [...] } 信封，与原页面的回退链保持一致
type InsightsPayload = InsightNote[] | { insights?: InsightNote[] };

const TYPE_COLORS = [
  { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E' },
  { bg: '#DBEAFE', border: '#BFDBFE', text: '#1E40AF' },
  { bg: '#D1FAE5', border: '#A7F3D0', text: '#065F46' },
  { bg: '#F3E8FF', border: '#E9D5FF', text: '#6B21A8' },
  { bg: '#FFE4E6', border: '#FECDD3', text: '#9F1239' },
];

function getColorForIndex(index: number) {
  return TYPE_COLORS[index % TYPE_COLORS.length];
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function Notes() {
  const notesQuery = useApiQuery<InsightsPayload>(['insights'], '/insights');
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);

  const createNote = useApiMutation(
    (data: Record<string, unknown>) => apiRequest('post', '/insights', data),
    [['insights']]
  );

  const notes = useMemo(() => {
    const data = notesQuery.data;
    const list = Array.isArray(data) ? data : data?.insights || [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notesQuery.data]);

  const handleAdd = async () => {
    const content = newNote.trim();
    if (!content) return;
    setAdding(true);
    try {
      await createNote.mutateAsync({ title: content.slice(0, 50), content });
      setNewNote('');
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setAdding(false);
    }
  };

  if (notesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="mb-6">
        <h1
          className="text-3xl mb-1"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          笔记与卡片
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          捕捉灵感，积累卡片，构建你的第二大脑
        </p>
      </div>

      {/* Quick Input */}
      <div className="card p-4 mb-8">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="记录一个想法、灵感或洞察... (Cmd+Enter 保存)"
          rows={3}
          className="w-full text-sm bg-transparent outline-none resize-none mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        />
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={adding || !newNote.trim()}
            className="btn btn-primary text-sm"
          >
            {adding ? '保存中...' : (
              <>
                <Plus size={14} />
                添加笔记
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {notes.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={32} />}
          title="还没有笔记"
          description="随时记录你的灵感和想法"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note, index) => {
            const color = getColorForIndex(index);
            return (
              <div
                key={note.id}
                className="card p-5 transition-all hover:shadow-md"
                style={{
                  backgroundColor: color.bg,
                  borderColor: color.border,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              >
                <p className="text-sm leading-relaxed mb-4" style={{ color: color.text }}>
                  {note.content}
                </p>
                <div className="flex items-center gap-1.5" style={{ color: color.text, opacity: 0.6 }}>
                  <Clock size={12} />
                  <span className="text-xs">{formatTime(note.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
