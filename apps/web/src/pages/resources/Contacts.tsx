import { useEffect, useState } from 'react';
import type { Contact as SharedContact, Domain } from '@meos/shared';
import { Plus, User, Phone, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import MockBadge from '../../components/MockBadge';
import { isMockItem } from '../../lib/mockFlag';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';

type Relation = 'friend' | 'colleague' | 'mentor' | 'family' | 'other';
type ContactFreq = 'weekly' | 'monthly' | 'quarterly';

interface ContactRow extends Omit<SharedContact, 'tags' | 'relation' | 'contactFreq'> {
  relation: Relation;
  tags?: string[];
  contactFreq?: ContactFreq;
  mock?: boolean;
  domain?: { id: string; name: string };
}

interface ContactSavePayload {
  name: string;
  title: string;
  company: string;
  relation: string;
  tags: string[];
  notes: string;
  contactFreq: string;
  domainId: string;
}

const RELATION_LABELS: Record<Relation, string> = {
  friend: '朋友',
  colleague: '同事',
  mentor: '导师',
  family: '家人',
  other: '其他',
};

const RELATION_COLORS: Record<Relation, string> = {
  friend: 'bg-sky-50 text-sky-600',
  colleague: 'bg-violet-50 text-violet-600',
  mentor: 'bg-amber-50 text-amber-600',
  family: 'bg-rose-50 text-rose-600',
  other: 'bg-slate-50 text-slate-500',
};

const FREQ_LABELS: Record<ContactFreq, string> = {
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
};

const FREQ_COLORS: Record<ContactFreq, string> = {
  weekly: 'bg-emerald-50 text-emerald-600',
  monthly: 'bg-blue-50 text-blue-600',
  quarterly: 'bg-orange-50 text-orange-600',
};

const FREQ_DAYS: Record<ContactFreq, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

const RELATIONS: Relation[] = ['friend', 'colleague', 'mentor', 'family', 'other'];

function needsContact(contact: ContactRow): boolean {
  if (!contact.contactFreq) return false;
  if (!contact.lastContact) return true;
  const lastDate = new Date(contact.lastContact);
  const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > FREQ_DAYS[contact.contactFreq];
}

function ContactModal({
  contact,
  domains,
  onSave,
  onClose,
}: {
  contact?: ContactRow | null;
  domains: Domain[];
  onSave: (data: ContactSavePayload) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    title: contact?.title || '',
    company: contact?.company || '',
    relation: contact?.relation || ('friend' as Relation),
    tags: contact?.tags?.join(', ') || '',
    notes: contact?.notes || '',
    contactFreq: contact?.contactFreq || ('monthly' as ContactFreq),
    domainId: contact?.domainId || '',
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50">
          <h2 className="text-lg font-medium text-slate-900">
            {contact ? '编辑联系人' : '添加联系人'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">姓名</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">职位</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">公司</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">关系</label>
            <select
              value={form.relation}
              onChange={(e) => setForm({ ...form, relation: e.target.value as Relation })}
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
            >
              {(Object.entries(RELATION_LABELS) as [Relation, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">标签 (逗号分隔)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
              placeholder="技术, 设计, 创业"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">联系频率</label>
              <select
                value={form.contactFreq}
                onChange={(e) => setForm({ ...form, contactFreq: e.target.value as ContactFreq })}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
              >
                {(Object.entries(FREQ_LABELS) as [ContactFreq, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">关联领域</label>
              <select
                value={form.domainId}
                onChange={(e) => setForm({ ...form, domainId: e.target.value })}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
              >
                <option value="">无</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] rounded-lg transition-all"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [activeRelation, setActiveRelation] = useState<Relation | 'all'>('all');
  const [showNeedsContact, setShowNeedsContact] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const contactsQuery = useApiQuery<{ contacts: ContactRow[] }>(['contacts'], '/contacts');
  const domainsQuery = useApiQuery<{ domains: Domain[] }>(['domains'], '/domains');

  const contacts = contactsQuery.data?.contacts ?? [];
  const domains = domainsQuery.data?.domains ?? [];

  const createContact = useApiMutation(
    (data: ContactSavePayload) => apiRequest('post', '/contacts', data),
    [['contacts']]
  );

  const updateContact = useApiMutation(
    ({ id, data }: { id: string; data: ContactSavePayload }) => apiRequest('patch', `/contacts/${id}`, data),
    [['contacts']]
  );

  const deleteContact = useApiMutation(
    (id: string) => apiRequest('delete', `/contacts/${id}`),
    [['contacts']]
  );

  const touchContact = useApiMutation(
    (id: string) => apiRequest('post', `/contacts/${id}/touch`),
    [['contacts']]
  );

  const clearContactMock = useApiMutation(
    ({ id }: { id: string }) => apiRequest('patch', `/contacts/${id}`, { mock: false }),
    [['contacts']]
  );

  const handleSave = async (data: ContactSavePayload) => {
    try {
      if (editingContact) {
        await updateContact.mutateAsync({ id: editingContact.id, data });
      } else {
        await createContact.mutateAsync(data);
      }
      setShowModal(false);
      setEditingContact(null);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteContact.mutateAsync(confirmDelete);
      setConfirmDelete(null);
    } catch {} finally { setDeleting(false); }
  };

  const handleTouch = async (id: string) => {
    try {
      await touchContact.mutateAsync(id);
    } catch {}
  };

  const filteredContacts = contacts.filter((c) => {
    if (showNeedsContact && !needsContact(c)) return false;
    if (activeRelation !== 'all' && c.relation !== activeRelation) return false;
    return true;
  });

  const needsCount = contacts.filter(needsContact).length;

  if (contactsQuery.isLoading || domainsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="mb-8">
        <div className="flex justify-between items-end">
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
              联系人
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              管理你的人脉关系和联系频率
            </p>
          </div>
          <button
            onClick={() => { setEditingContact(null); setShowModal(true); }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            添加联系人
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <button
            onClick={() => setActiveRelation('all')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              activeRelation === 'all' ? 'bg-[var(--color-surface)]' : ''
            }`}
            style={{
              backgroundColor: activeRelation === 'all' ? 'var(--color-surface)' : 'transparent',
              color: activeRelation === 'all' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              boxShadow: activeRelation === 'all' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            全部
          </button>
          {RELATIONS.map((rel) => (
            <button
              key={rel}
              onClick={() => setActiveRelation(rel)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                activeRelation === rel ? 'bg-[var(--color-surface)]' : ''
              }`}
              style={{
                backgroundColor: activeRelation === rel ? 'var(--color-surface)' : 'transparent',
                color: activeRelation === rel ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                boxShadow: activeRelation === rel ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {RELATION_LABELS[rel]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNeedsContact(!showNeedsContact)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showNeedsContact
              ? 'bg-amber-50'
              : ''
          }`}
          style={
            showNeedsContact
              ? { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-warning)' }
              : { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }
          }
        >
          需要联系 {needsCount > 0 && `(${needsCount})`}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-[var(--color-surface)] rounded-xl border border-slate-100 p-5 group hover:border-slate-200 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-slate-900 flex items-center gap-1.5">
                    {contact.name}
                    {isMockItem(contact) && (
                      <MockBadge
                        onClick={async () => {
                          await clearContactMock.mutateAsync({ id: contact.id });
                        }}
                      />
                    )}
                  </h3>
                  {(contact.title || contact.company) && (
                    <p className="text-sm text-slate-500">
                      {contact.title}{contact.title && contact.company ? ' @ ' : ''}{contact.company}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingContact(contact); setShowModal(true); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(contact.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${RELATION_COLORS[contact.relation]}`}>
                {RELATION_LABELS[contact.relation]}
              </span>
              {contact.contactFreq && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${FREQ_COLORS[contact.contactFreq]}`}>
                  {FREQ_LABELS[contact.contactFreq]}
                </span>
              )}
              {contact.tags?.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500">
                  {tag}
                </span>
              ))}
            </div>

            {needsContact(contact) && (
              <div className="mt-3 px-2 py-1 rounded-md bg-amber-50 text-[10px] font-medium text-amber-600 inline-block">
                需要联系
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
              <div className="text-xs text-slate-400">
                {contact.lastContact
                  ? `上次联系: ${format(new Date(contact.lastContact), 'yyyy-MM-dd')}`
                  : '从未联系'}
              </div>
              <button
                onClick={() => handleTouch(contact.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                <Phone className="w-3.5 h-3.5" />
                联系
              </button>
            </div>


          </div>
        ))}

        {filteredContacts.length === 0 && (
          <div className="col-span-2">
            <EmptyState
              icon={<User className="w-8 h-8" />}
              title="暂无联系人"
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="删除联系人"
        message="确定删除这个联系人？此操作不可撤销。"
        variant="danger"
        loading={deleting}
      />

      {showModal && (
        <ContactModal
          contact={editingContact}
          domains={domains}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingContact(null); }}
        />
      )}
    </div>
  );
}
