import { useEffect, useState } from 'react';
import type { Opportunity, OpportunityStage, OpportunityTrack } from '@meos/shared';
import { PARTNERS } from '@meos/shared';
import { OPPORTUNITY_STAGES } from '@meos/shared';
import Modal from '../../components/Modal';
import { TRACK_CONFIGS, OPPORTUNITY_STAGE_LABELS } from './constants';

export interface OpportunitySavePayload {
  track: OpportunityTrack;
  title: string;
  stage: OpportunityStage;
  company: string;
  category: string;
  source: string;
  partner: string;
  contact: string;
  amount: number | null;
  link: string;
  notes: string;
}

interface OpportunityModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: OpportunitySavePayload) => Promise<void>;
  initial?: Opportunity | null;
  defaultTrack: OpportunityTrack;
}

const EMPTY: OpportunitySavePayload = {
  track: 'fde',
  title: '',
  stage: 'lead',
  company: '',
  category: '',
  source: '',
  partner: '',
  contact: '',
  amount: null,
  link: '',
  notes: '',
};

function fieldStyle() {
  return {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  } as React.CSSProperties;
}

function labelStyle() {
  return {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    marginBottom: '0.25rem',
  } as React.CSSProperties;
}

export default function OpportunityModal({ open, onClose, onSave, initial, defaultTrack }: OpportunityModalProps) {
  const [form, setForm] = useState<OpportunitySavePayload>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        track: initial.track,
        title: initial.title,
        stage: initial.stage,
        company: initial.company ?? '',
        category: initial.category ?? '',
        source: initial.source ?? '',
        partner: initial.partner ?? '',
        contact: initial.contact ?? '',
        amount: initial.amount ?? null,
        link: initial.link ?? '',
        notes: initial.notes ?? '',
      });
    } else {
      setForm({ ...EMPTY, track: defaultTrack });
    }
  }, [open, initial, defaultTrack]);

  const set = <K extends keyof OpportunitySavePayload>(key: K, value: OpportunitySavePayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const categories = TRACK_CONFIGS[form.track].categories;
  const sources = TRACK_CONFIGS[form.track].sources;

  return (
    <Modal open={open} onClose={onClose} title={initial ? '编辑商机' : '新增商机'} maxWidth="max-w-2xl">
      <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle()}>板块 *</label>
            <select value={form.track} onChange={(e) => set('track', e.target.value as OpportunityTrack)} style={fieldStyle()}>
              {(Object.keys(TRACK_CONFIGS) as OpportunityTrack[]).map((t) => (
                <option key={t} value={t}>{TRACK_CONFIGS[t].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>阶段</label>
            <select value={form.stage} onChange={(e) => set('stage', e.target.value as OpportunityStage)} style={fieldStyle()}>
              {OPPORTUNITY_STAGES.map((s) => (
                <option key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle()}>商机名称 *</label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="如：意定监护合作"
            style={fieldStyle()}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle()}>公司 / 主体</label>
            <input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="如：意安顿健康科技（重庆）有限公司" style={fieldStyle()} />
          </div>
          <div>
            <label style={labelStyle()}>类型</label>
            <input
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              list="opp-category-suggestions"
              placeholder="选择或输入"
              style={fieldStyle()}
            />
            <datalist id="opp-category-suggestions">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label style={labelStyle()}>来源</label>
            <input
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              list="opp-source-suggestions"
              placeholder="选择或输入"
              style={fieldStyle()}
            />
            <datalist id="opp-source-suggestions">
              {sources.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label style={labelStyle()}>合伙人</label>
            <select value={form.partner} onChange={(e) => set('partner', e.target.value)} style={fieldStyle()}>
              <option value="">不指定</option>
              {PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>联系方式</label>
            <input value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="姓名 / 电话 / 微信" style={fieldStyle()} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle()}>预估金额（元）</label>
            <input
              type="number"
              min="0"
              value={form.amount ?? ''}
              onChange={(e) => set('amount', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="选填"
              style={fieldStyle()}
            />
          </div>
          <div>
            <label style={labelStyle()}>相关链接</label>
            <input value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" style={fieldStyle()} />
          </div>
        </div>

        <div>
          <label style={labelStyle()}>备注</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="背景、进展、下一步动作…"
            style={{ ...fieldStyle(), resize: 'vertical' }}
          />
        </div>
      </div>

      <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.title.trim() || saving}
          className="px-5 py-2 text-sm rounded-lg transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-ink)' }}
        >
          {saving ? '保存中…' : initial ? '保存' : '创建'}
        </button>
      </div>
    </Modal>
  );
}
