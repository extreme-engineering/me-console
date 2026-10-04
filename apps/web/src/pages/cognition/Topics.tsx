import { useState } from 'react';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmDialog from '../../components/ConfirmDialog';
import MockBadge from '../../components/MockBadge';
import { isMockItem } from '../../lib/mockFlag';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  MessageSquare,
} from 'lucide-react';

const CATEGORIES = ['心理', '身体', '工作', '生活'];

const STATUS_LABELS: Record<string, string> = {
  探索中: '探索中',
  研究中: '研究中',
  实践中: '实践中',
  突破: '突破',
  持续中: '持续中',
  已归档: '已归档',
};

const PRIORITIES = ['high', 'medium', 'low'] as const;

const NOTE_TYPES = ['reflection', 'insight', 'breakthrough', 'setback'] as const;

const NOTE_TYPE_LABELS: Record<string, string> = {
  reflection: '反思',
  insight: '洞察',
  breakthrough: '突破',
  setback: '挫折',
};

const STATUS_COLORS: Record<string, string> = {
  探索中: 'bg-blue-100 text-blue-700',
  研究中: 'bg-violet-100 text-violet-700',
  实践中: 'bg-emerald-100 text-emerald-700',
  突破: 'bg-amber-100 text-amber-700',
  持续中: 'bg-slate-100 text-slate-700',
  已归档: 'bg-gray-100 text-gray-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  reflection: 'bg-sky-100 text-sky-700',
  insight: 'bg-purple-100 text-purple-700',
  breakthrough: 'bg-amber-100 text-amber-700',
  setback: 'bg-rose-100 text-rose-700',
};

interface Note {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  currentUnderstanding: string;
  actionPlan: string;
  notes: Note[];
  isMock?: boolean;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TopicFormData {
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  currentUnderstanding: string;
  actionPlan: string;
}

interface TopicsResponse {
  topics: Topic[];
}

const emptyForm: TopicFormData = {
  title: '',
  description: '',
  category: CATEGORIES[0],
  status: '探索中',
  priority: 'medium',
  currentUnderstanding: '',
  actionPlan: '',
};

export default function Topics() {
  const topicsQuery = useApiQuery<TopicsResponse>(['topics'], '/topics');
  const topics = topicsQuery.data?.topics ?? [];

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<string>('reflection');
  const [form, setForm] = useState<TopicFormData>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);

  const createTopic = useApiMutation(
    (data: TopicFormData) => apiRequest('post', '/topics', data),
    [['topics']]
  );
  const updateTopic = useApiMutation(
    ({ id, data }: { id: string; data: TopicFormData }) => apiRequest('patch', `/topics/${id}`, data),
    [['topics']]
  );
  const deleteTopic = useApiMutation((id: string) => apiRequest('delete', `/topics/${id}`), [['topics']]);
  const addTopicNote = useApiMutation(
    ({ topicId, data }: { topicId: string; data: Record<string, unknown> }) =>
      apiRequest('post', `/topics/${topicId}/notes`, data),
    [['topics']]
  );
  const deleteTopicNote = useApiMutation(
    ({ topicId, noteId }: { topicId: string; noteId: string }) =>
      apiRequest('delete', `/topics/${topicId}/notes/${noteId}`),
    [['topics']]
  );
  const claimTopicMutation = useApiMutation(
    ({ id }: { id: string }) => apiRequest('patch', `/topics/${id}`, { isMock: false, mock: false }),
    [['topics']]
  );

  const openAddModal = () => {
    setEditingTopic(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (topic: Topic) => {
    setEditingTopic(topic);
    setForm({
      title: topic.title,
      description: topic.description,
      category: topic.category,
      status: topic.status,
      priority: topic.priority,
      currentUnderstanding: topic.currentUnderstanding,
      actionPlan: topic.actionPlan,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTopic(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    try {
      if (editingTopic) {
        await updateTopic.mutateAsync({ id: editingTopic.id, data: form });
      } else {
        await createTopic.mutateAsync(form);
      }
      closeModal();
    } catch {}
  };

  const claimTopic = (topic: Topic) => {
    claimTopicMutation.mutate({ id: topic.id });
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteTopic.mutateAsync(confirmDelete);
      setConfirmDelete(null);
      setExpandedId(null);
    } catch {} finally { setDeleting(false); }
  };

  const handleAddNote = async (topicId: string) => {
    if (!noteContent.trim()) return;
    try {
      await addTopicNote.mutateAsync({
        topicId,
        data: { noteType: noteType, content: noteContent },
      });
      setNoteContent('');
      setNoteType('reflection');
      setShowNoteForm(null);
    } catch {}
  };

  const handleDeleteNote = async (topicId: string, noteId: string) => {
    if (!confirm('确定删除这条笔记？')) return;
    try {
      await deleteTopicNote.mutateAsync({ topicId, noteId });
    } catch {}
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setShowNoteForm(null);
  };

  const filteredTopics =
    categoryFilter === 'all'
      ? topics
      : topics.filter((t) => t.category === categoryFilter);

  const categoryCount = (cat: string) =>
    cat === 'all' ? topics.length : topics.filter((t) => t.category === cat).length;

  const truncate = (str: string, len: number) =>
    str && str.length > len ? str.slice(0, len) + '…' : str;

  if (topicsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-3xl mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
            }}
          >
            课题管理
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            探索、实践、突破重要课题
          </p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          <Plus size={16} />
          新建课题
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-wrap gap-2">
          {['all', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-[var(--color-ink-soft)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-text-tertiary)]'
              }`}
            >
              {cat === 'all' ? '全部' : cat}
              <span className="ml-1.5 text-xs opacity-70">{categoryCount(cat)}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditingCategories(true)}
          className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          title="管理分类"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

      {filteredTopics.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          暂无课题，点击「新建课题」开始探索
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTopics.map((topic) => {
            const isExpanded = expandedId === topic.id;
            const latestNote =
              topic.notes && topic.notes.length > 0
                ? [...topic.notes].sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  )[0]
                : null;

            return (
              <div
                key={topic.id}
                className="bg-[var(--color-surface)] rounded-xl border border-slate-100 p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-base font-medium text-slate-900">
                        {topic.title}
                      </h3>
                      {isMockItem(topic) && <MockBadge onClick={() => claimTopic(topic)} />}
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                        {topic.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                          STATUS_COLORS[topic.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {STATUS_LABELS[topic.status] || topic.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                          PRIORITY_COLORS[topic.priority] || ''
                        }`}
                      >
                        {topic.priority}
                      </span>
                    </div>

                    {topic.currentUnderstanding && !isExpanded && (
                      <p className="text-sm text-slate-500 mb-2">
                        {truncate(topic.currentUnderstanding, 120)}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {topic.notes && topic.notes.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {topic.notes.length} 条笔记
                        </span>
                      )}
                      {latestNote && !isExpanded && (
                        <span className="text-slate-400 truncate max-w-xs">
                          最新: {truncate(latestNote.content, 50)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(topic)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(topic.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleExpand(topic.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>



                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {topic.currentUnderstanding && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                          当前理解
                        </h4>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {topic.currentUnderstanding}
                        </p>
                      </div>
                    )}

                    {topic.actionPlan && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                          行动计划
                        </h4>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {topic.actionPlan}
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                          笔记
                        </h4>
                        <button
                          onClick={() =>
                            setShowNoteForm(
                              showNoteForm === topic.id ? null : topic.id,
                            )
                          }
                          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          添加笔记
                        </button>
                      </div>

                      {showNoteForm === topic.id && (
                        <div className="bg-slate-50 rounded-lg p-4 mb-3 space-y-3">
                          <select
                            value={noteType}
                            onChange={(e) => setNoteType(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm"
                          >
                            {NOTE_TYPES.map((nt) => (
                              <option key={nt} value={nt}>
                                {NOTE_TYPE_LABELS[nt]}
                              </option>
                            ))}
                          </select>
                          <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="写下你的思考..."
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddNote(topic.id)}
                              className="bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                            >
                              提交
                            </button>
                            <button
                              onClick={() => setShowNoteForm(null)}
                              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {topic.notes && topic.notes.length > 0 ? (
                        <div className="space-y-2">
                          {[...topic.notes]
                            .sort(
                              (a, b) =>
                                new Date(b.createdAt).getTime() -
                                new Date(a.createdAt).getTime(),
                            )
                            .map((note) => (
                              <div
                                key={note.id}
                                className="bg-slate-50 rounded-lg p-3"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                                      NOTE_TYPE_COLORS[note.type] ||
                                      'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {NOTE_TYPE_LABELS[note.type] || note.type}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {new Date(note.createdAt).toLocaleDateString(
                                      'zh-CN',
                                    )}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteNote(topic.id, note.id)}
                                    className="ml-auto p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                  {note.content}
                                </p>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">暂无笔记</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="删除课题"
        message="确认删除此课题？此操作不可撤销。"
        variant="danger"
        loading={deleting}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-medium text-slate-900 mb-5">
                {editingTopic ? '编辑课题' : '新建课题'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    标题
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="课题标题"
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    描述
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="简要描述这个课题"
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      分类
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      状态
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm"
                    >
                      {Object.keys(STATUS_LABELS).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      优先级
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p === 'high' ? '高' : p === 'medium' ? '中' : '低'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    当前理解
                  </label>
                  <textarea
                    value={form.currentUnderstanding}
                    onChange={(e) =>
                      setForm({ ...form, currentUnderstanding: e.target.value })
                    }
                    placeholder="你对这个课题的当前理解"
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    行动计划
                  </label>
                  <textarea
                    value={form.actionPlan}
                    onChange={(e) =>
                      setForm({ ...form, actionPlan: e.target.value })
                    }
                    placeholder="接下来打算怎么做"
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSubmit}
                  className="bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
                >
                  {editingTopic ? '保存' : '创建'}
                </button>
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editingCategories && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditingCategories(false)}
          />
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h2 className="text-lg font-medium text-slate-900 mb-4">管理分类</h2>
              <div className="space-y-2 mb-4">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700">{cat}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setEditingCategories(false)}
                className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
