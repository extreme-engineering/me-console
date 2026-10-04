import { useMemo, useState } from 'react';
import type { HealthRecord } from '@meos/shared';
import { keepPreviousData } from '@tanstack/react-query';
import { Plus, Activity, Trash2, Edit2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import LineChart from './charts/LineChart';
import MockBadge from './MockBadge';
import { isMockItem } from '../lib/mockFlag';
import { apiRequest, useApiMutation, useApiQuery } from '../lib/api-queries';
import { toast } from '../stores/toastStore';

type HealthType = 'sleep' | 'exercise' | 'weight' | 'mood' | 'energy' | 'water';

interface HealthRecordRow extends HealthRecord {
  date?: string;
  mock?: boolean;
}

interface HealthSummaryEntry {
  avg: number;
  count: number;
  latest: number;
}

type HealthSummary = Record<HealthType, HealthSummaryEntry>;

const TYPE_LABELS: Record<HealthType, string> = {
  sleep: '睡眠',
  exercise: '运动',
  weight: '体重',
  mood: '心情',
  energy: '精力',
  water: '饮水',
};

const TYPE_UNITS: Record<HealthType, string> = {
  sleep: 'hours',
  exercise: 'minutes',
  weight: 'kg',
  mood: 'score',
  energy: 'score',
  water: 'ml',
};

const TYPE_COLORS: Record<HealthType, string> = {
  sleep: '#818cf8',
  exercise: '#34d399',
  weight: '#fbbf24',
  mood: '#f472b6',
  energy: '#fb923c',
  water: '#38bdf8',
};

const TYPES: HealthType[] = ['sleep', 'exercise', 'weight', 'mood', 'energy', 'water'];

export default function HealthTrackerView() {
  const [activeType, setActiveType] = useState<HealthType>('sleep');
  const [addValue, setAddValue] = useState('');
  const [addNote, setAddNote] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecordRow | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNote, setEditNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const to = format(new Date(), 'yyyy-MM-dd');
  const from = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  const recordsQuery = useApiQuery<{ records: HealthRecordRow[] }>(
    ['health', activeType],
    `/health?type=${activeType}&from=${from}&to=${to}`,
    { placeholderData: keepPreviousData }
  );
  const summaryQuery = useApiQuery<{ summary: HealthSummary }>(['health/summary'], '/health/summary?days=7');

  const records = useMemo(() => recordsQuery.data?.records ?? [], [recordsQuery.data]);
  const summary = summaryQuery.data?.summary ?? null;

  const addHealthRecord = useApiMutation(
    (data: { type: string; value: number; unit: string; note?: string }) =>
      apiRequest('post', '/health', data),
    [['health'], ['health/summary']]
  );

  const updateHealthRecord = useApiMutation(
    ({ id, data }: { id: string; data: { value?: number; note?: string; mock?: boolean } }) =>
      apiRequest('patch', `/health/${id}`, data),
    [['health'], ['health/summary']]
  );

  const deleteHealthRecord = useApiMutation(
    (id: string) => apiRequest('delete', `/health/${id}`),
    [['health'], ['health/summary']]
  );

  const handleAdd = async () => {
    const value = parseFloat(addValue);
    if (isNaN(value)) return;
    try {
      await addHealthRecord.mutateAsync({
        type: activeType,
        value,
        unit: TYPE_UNITS[activeType],
        note: addNote || undefined,
      });
      setAddValue('');
      setAddNote('');
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return;
    try {
      await deleteHealthRecord.mutateAsync(id);
    } catch {}
  };

  const openEdit = (record: HealthRecordRow) => {
    setEditingRecord(record);
    setEditValue(String(record.value));
    setEditNote(record.note ?? '');
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editingRecord) return;
    const value = parseFloat(editValue);
    if (isNaN(value)) return;
    setSubmitting(true);
    try {
      await updateHealthRecord.mutateAsync({
        id: editingRecord.id,
        data: { value, note: editNote || undefined },
      });
      setShowEditModal(false);
      setEditingRecord(null);
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const day = format(new Date(r.recordedAt || r.date || ''), 'MM-dd');
      map.set(day, r.value);
    });
    const result: { date: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = format(subDays(new Date(), i), 'MM-dd');
      result.push({ date: day, value: map.get(day) || 0 });
    }
    return result;
  }, [records]);

  if (recordsQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-12 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        {TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              activeType === type
                ? 'bg-[var(--color-surface)] font-medium'
                : ''
            }`}
            style={{
              backgroundColor: activeType === type ? 'var(--color-surface)' : 'transparent',
              color: activeType === type ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              boxShadow: activeType === type ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="card p-5 mb-6">
        <div className="flex gap-3">
          <input
            type="number"
            step="any"
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            placeholder={`输入${TYPE_LABELS[activeType]}值 (${TYPE_UNITS[activeType]})`}
            className="input"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <input
            type="text"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            placeholder="备注 (可选)"
            className="input"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="btn btn-primary shrink-0"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>

      {summary && summary[activeType] && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>平均值</p>
            <p className="text-2xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--color-text-primary)' }}>
              {summary[activeType].avg ? summary[activeType].avg.toFixed(1) : '-'}
              <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{TYPE_UNITS[activeType]}</span>
            </p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>记录数</p>
            <p className="text-2xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--color-text-primary)' }}>{summary[activeType].count || 0}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>最新值</p>
            <p className="text-2xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--color-text-primary)' }}>
              {summary[activeType].latest ? summary[activeType].latest.toFixed(1) : '-'}
              <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{TYPE_UNITS[activeType]}</span>
            </p>
          </div>
        </div>
      )}

      <div className="card p-5 mb-6">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>近14天趋势</p>
        {chartData.some((d) => d.value > 0) ? (
          <LineChart
            data={chartData}
            xKey="date"
            series={[{ key: 'value', color: TYPE_COLORS[activeType] }]}
            height={200}
          />
        ) : (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>暂无数据</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {records.map((record) => (
          <div
            key={record.id}
            className="card p-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <Activity className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {record.value} <span style={{ color: 'var(--color-text-tertiary)' }}>{record.unit}</span>
                </p>
                {record.note && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{record.note}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isMockItem(record) && (
                <MockBadge
                  onClick={async () => {
                    await updateHealthRecord.mutateAsync({ id: record.id, data: { mock: false } });
                  }}
                />
              )}
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{format(new Date(record.recordedAt || record.date || ''), 'yyyy-MM-dd')}</span>
              <button
                onClick={() => openEdit(record)}
                className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(record.id)}
                className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--color-error)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {records.length === 0 && (
          <div className="card p-12 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无记录</p>
          </div>
        )}
      </div>

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑记录"
        maxWidth="max-w-sm"
      >
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
              {TYPE_LABELS[activeType]} ({TYPE_UNITS[activeType]})
            </label>
            <input
              type="number"
              step="any"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>备注</label>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="input"
              placeholder="备注 (可选)"
            />
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
          <button onClick={() => setShowEditModal(false)} className="btn btn-ghost">
            取消
          </button>
          <button onClick={handleEdit} disabled={submitting} className="btn btn-primary">
            保存
          </button>
        </div>
      </Modal>
    </div>
  );
}
