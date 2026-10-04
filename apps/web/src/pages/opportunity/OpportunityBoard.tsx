import { useMemo, useState } from 'react';
import type { Opportunity, OpportunityStage, OpportunityTrack } from '@meos/shared';
import { PARTNERS } from '@meos/shared';
import { Plus, Search, Link2, Trash2, AlertCircle, Handshake, Target, CheckCircle2, Bell } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import OpportunityModal, { type OpportunitySavePayload } from './OpportunityModal';
import {
  PARTNER_COLORS,
  STAGE_COLORS,
  STAGE_FLOW,
  TRACK_CONFIGS,
  FOLLOW_UP_DAYS,
  formatAmount,
  isStale,
  OPPORTUNITY_STAGE_LABELS,
} from './constants';

type PartnerFilter = 'all' | 'none' | string;

function StatCard({ icon: Icon, label, value, hint, tone }: {
  icon: typeof Target;
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
}) {
  return (
    <div
      className="flex-1 min-w-[150px] p-4 rounded-xl"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: tone ?? 'var(--color-text-tertiary)' }} />
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
      </div>
      <div className="text-xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {value}
      </div>
      {hint && <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{hint}</div>}
    </div>
  );
}

export default function OpportunityBoard({ track }: { track: OpportunityTrack }) {
  const config = TRACK_CONFIGS[track];

  const opportunitiesQuery = useApiQuery<{ opportunities: Opportunity[] }>(['opportunities'], '/opportunities');
  const opportunities = useMemo(
    () => (opportunitiesQuery.data?.opportunities ?? []).filter((o) => o.track === track),
    [opportunitiesQuery.data, track]
  );

  const createOpportunity = useApiMutation(
    (data: OpportunitySavePayload) => apiRequest('post', '/opportunities', data),
    [['opportunities']]
  );
  const updateOpportunity = useApiMutation(
    ({ id, data }: { id: string; data: Partial<OpportunitySavePayload> }) =>
      apiRequest('patch', `/opportunities/${id}`, data),
    [['opportunities']]
  );
  const deleteOpportunity = useApiMutation((id: string) => apiRequest('delete', `/opportunities/${id}`), [['opportunities']]);

  const [search, setSearch] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<PartnerFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (partnerFilter === 'none' && o.partner) return false;
      if (partnerFilter !== 'all' && partnerFilter !== 'none' && o.partner !== partnerFilter) return false;
      if (!q) return true;
      return [o.title, o.company, o.category, o.source, o.notes, o.link]
        .some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [opportunities, search, partnerFilter]);

  const stats = useMemo(() => {
    const active = opportunities.filter((o) => !['won', 'delivered', 'lost'].includes(o.stage));
    const closed = opportunities.filter((o) => o.stage === 'won' || o.stage === 'delivered');
    const pipelineAmount = active.reduce((sum, o) => sum + (o.amount ?? 0), 0);
    const wonAmount = opportunities
      .filter((o) => o.stage === 'won' || o.stage === 'delivered')
      .reduce((sum, o) => sum + (o.amount ?? 0), 0);
    const stale = opportunities.filter(isStale);
    return { total: opportunities.length, active: active.length, closed: closed.length, pipelineAmount, wonAmount, stale };
  }, [opportunities]);

  const handleSave = async (data: OpportunitySavePayload) => {
    if (editing) {
      await updateOpportunity.mutateAsync({ id: editing.id, data });
    } else {
      await createOpportunity.mutateAsync(data);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleStageChange = async (opp: Opportunity, stage: OpportunityStage) => {
    if (stage === opp.stage) return;
    try {
      await updateOpportunity.mutateAsync({ id: opp.id, data: { stage } });
    } catch {}
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteOpportunity.mutateAsync(confirmDelete);
      setConfirmDelete(null);
    } catch {} finally {
      setDeleting(false);
    }
  };

  if (opportunitiesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* 漏斗统计 */}
      <div className="flex gap-3 flex-wrap mb-4">
        <StatCard icon={Target} label="商机总数" value={stats.total} />
        <StatCard icon={Handshake} label="推进中" value={stats.active} hint={`漏斗金额 ${formatAmount(stats.pipelineAmount) ?? '—'}`} />
        <StatCard icon={CheckCircle2} label="已成交 / 已交付" value={stats.closed} hint={`落袋金额 ${formatAmount(stats.wonAmount) ?? '—'}`} tone="#10b981" />
        <StatCard icon={Bell} label={`超 ${FOLLOW_UP_DAYS} 天未跟进`} value={stats.stale.length} tone={stats.stale.length > 0 ? '#f59e0b' : undefined} />
      </div>

      {/* 跟进提醒 */}
      {stats.stale.length > 0 && (
        <div
          className="mb-4 p-3 rounded-xl flex items-start gap-2 flex-wrap"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: '#b45309' }} />
          <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            以下商机超 {FOLLOW_UP_DAYS} 天没有动静，安排一次跟进：
            {stats.stale.map((o) => (
              <button
                key={o.id}
                onClick={() => { setEditing(o); setShowModal(true); }}
                className="ml-1.5 mr-1 px-2 py-0.5 rounded-md font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#b45309' }}
              >
                {o.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 工具行：搜索 + 合伙人筛选 + 新增 */}
      <div className="flex gap-3 items-center flex-wrap mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索名称 / 公司 / 备注…"
            className="pl-8 pr-3 py-2 text-sm rounded-lg"
            style={{
              width: '15rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={partnerFilter === 'all'} onClick={() => setPartnerFilter('all')} label="全部" />
          {PARTNERS.map((p) => (
            <FilterChip
              key={p}
              active={partnerFilter === p}
              onClick={() => setPartnerFilter(partnerFilter === p ? 'all' : p)}
              label={p}
              dot={PARTNER_COLORS[p]}
            />
          ))}
          <FilterChip active={partnerFilter === 'none'} onClick={() => setPartnerFilter(partnerFilter === 'none' ? 'all' : 'none')} label="未分配" />
        </div>

        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-ink)' }}
        >
          <Plus size={15} />
          新增商机
        </button>
      </div>

      {/* 看板 */}
      {opportunities.length === 0 ? (
        <EmptyState
          icon={<Handshake size={32} />}
          title={`还没有${config.label}商机`}
          description={config.description}
          action={
            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="px-4 py-2 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-ink)' }}
            >
              记录第一个商机
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="没有匹配的商机" description="换个关键词或筛选条件试试" />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '20rem' }}>
          {STAGE_FLOW.map((stage) => {
            const items = filtered.filter((o) => o.stage === stage);
            const color = STAGE_COLORS[stage];
            return (
              <div key={stage} className="shrink-0 w-60 flex flex-col">
                <div className="flex items-center gap-2 px-2 py-2 mb-2 rounded-lg" style={{ backgroundColor: color.bg }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.dot }} />
                  <span className="text-xs font-medium" style={{ color: color.text }}>
                    {OPPORTUNITY_STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: color.text }}>{items.length}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {items.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => { setEditing(o); setShowModal(true); }}
                      className="group p-3 rounded-xl cursor-pointer transition-shadow hover:shadow-md"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        opacity: stage === 'lost' ? 0.65 : 1,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                          {o.title}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(o.id); }}
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          aria-label="删除商机"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {o.company && (
                        <div className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                          {o.company}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {o.partner && (
                          <span
                            className="px-1.5 py-0.5 text-[10px] rounded-md font-medium"
                            style={{ backgroundColor: `${PARTNER_COLORS[o.partner] ?? '#94a3b8'}22`, color: PARTNER_COLORS[o.partner] ?? '#64748b' }}
                          >
                            {o.partner}
                          </span>
                        )}
                        {o.category && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded-md" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}>
                            {o.category}
                          </span>
                        )}
                        {formatAmount(o.amount) && (
                          <span className="text-[10px] font-medium" style={{ color: '#047857' }}>
                            {formatAmount(o.amount)}
                          </span>
                        )}
                      </div>

                      {o.notes && (
                        <div className="text-xs mt-2 leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                          {o.notes}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2.5 pt-2" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                        {o.link && (
                          <a
                            href={o.link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
                            style={{ color: '#0284c7' }}
                          >
                            <Link2 size={11} />
                            链接
                          </a>
                        )}
                        {isStale(o) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#b45309' }}>
                            待跟进
                          </span>
                        )}
                        <select
                          value={o.stage}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStageChange(o, e.target.value as OpportunityStage)}
                          className="ml-auto text-[11px] rounded-md px-1.5 py-1"
                          style={{
                            border: '1px solid var(--color-border-light)',
                            backgroundColor: 'var(--color-bg)',
                            color: 'var(--color-text-secondary)',
                            outline: 'none',
                          }}
                        >
                          {STAGE_FLOW.map((s) => (
                            <option key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OpportunityModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing}
        defaultTrack={track}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="删除商机"
        message="删除后无法恢复，确定删除这条商机吗？"
        confirmLabel="删除"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

function FilterChip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all"
      style={{
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
        backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--color-surface)',
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot }} />}
      {label}
    </button>
  );
}
