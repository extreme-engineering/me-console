import { useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Plus, Trash2, Check } from 'lucide-react';
import api from '../../lib/api';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import FormField from '../../components/FormField';
import LoadingSpinner from '../../components/LoadingSpinner';
import MockBadge, { MockClaimField } from '../../components/MockBadge';
import type { BrandPillar, BrandProfile } from '@meos/shared';
import { toast } from '../../stores/toastStore';

const FIELDS: { key: keyof BrandProfile; label: string; textarea?: boolean; placeholder: string }[] = [
  { key: 'mission', label: '定位宣言', textarea: true, placeholder: '我为谁提供什么独特价值？' },
  { key: 'positioning', label: '一句话定位', placeholder: '如：帮创业者用系统经营人生' },
  { key: 'slogan', label: 'Slogan', placeholder: '如：用系统经营人生' },
  { key: 'personaTags', label: '人设关键词', placeholder: '逗号分隔，如：系统思维、长期主义、builder' },
  { key: 'targetAudience', label: '目标受众', textarea: true, placeholder: '他们在乎什么？在哪里？' },
  { key: 'toneOfVoice', label: '语调规范', textarea: true, placeholder: '理性、直接、有温度；避免夸大' },
  { key: 'visualNotes', label: '视觉规范', textarea: true, placeholder: '头像、配色、字体等约定' },
];

interface ProfileResponse {
  profile: BrandProfile;
}

interface PillarsResponse {
  pillars: BrandPillar[];
}

export default function Profile() {
  const profileQuery = useApiQuery<ProfileResponse>(['brand/profile'], '/brand/profile');
  const pillarsQuery = useApiQuery<PillarsResponse>(['brand/pillars'], '/brand/pillars');
  const pillars = pillarsQuery.data?.pillars ?? [];

  const [profile, setProfile] = useState<Partial<BrandProfile>>({});
  const [newPillar, setNewPillar] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // profile 为可编辑表单态：查询数据到达后同步（对应原 load() 中的一次性赋值）
  useEffect(() => {
    setProfile(profileQuery.data?.profile || {});
  }, [profileQuery.data]);

  const saveProfile = useApiMutation(
    async (data: Record<string, unknown>) => {
      // api 联合类型（AxiosInstance | LocalDBAdapter）未声明 put，但 /brand/profile 后端仅注册 PUT
      const res = await (api as AxiosInstance).put('/brand/profile', data);
      return res.data as { profile: BrandProfile };
    },
    [['brand/profile'], ['brand/overview']]
  );
  const addPillar = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/brand/pillars', data), [
    ['brand/pillars'],
    ['brand/overview'],
  ]);
  const deletePillar = useApiMutation((id: string) => apiRequest('delete', `/brand/pillars/${id}`), [
    ['brand/pillars'],
    ['brand/overview'],
  ]);
  const updatePillar = useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/brand/pillars/${id}`, data),
    [['brand/pillars'], ['brand/overview']]
  );

  const handleSave = async () => {
    setSaving(true);
    setJustSaved(false);
    try {
      const payload = Object.fromEntries(FIELDS.map((f) => [f.key, profile[f.key] ?? null]));
      payload.isMock = profile.isMock ?? false;
      const res = await saveProfile.mutateAsync(payload);
      setProfile(res.profile);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPillar = async () => {
    const name = newPillar.trim();
    if (!name) return;
    try {
      await addPillar.mutateAsync({ name });
      setNewPillar('');
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleDeletePillar = async (id: string) => {
    try {
      await deletePillar.mutateAsync(id);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const claimPillar = async (pillar: BrandPillar) => {
    try {
      await updatePillar.mutateAsync({ id: pillar.id, data: { isMock: false } });
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  if (profileQuery.isLoading || pillarsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter max-w-3xl">
      <div className="card p-6 mb-6">
        {profile.isMock && (
          <div className="flex items-center justify-end mb-2">
            <MockClaimField isMock={!!profile.isMock} onChange={(v) => setProfile((prev) => ({ ...prev, isMock: v }))} />
          </div>
        )}
        <div className="space-y-4">
          {FIELDS.map((field) => (
            <FormField key={field.key} label={field.label}>
              {field.textarea ? (
                <textarea
                  value={(profile[field.key] as string) || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={3}
                  className="input resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={(profile[field.key] as string) || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="input"
                />
              )}
            </FormField>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm">
            {justSaved ? (
              <>
                <Check size={14} /> 已保存
              </>
            ) : saving ? (
              '保存中...'
            ) : (
              '保存品牌资产'
            )}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-medium mb-1">内容支柱</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          3-5 个长期内容方向，选题时挂靠，保证输出不散
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPillar}
            onChange={(e) => setNewPillar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddPillar();
              }
            }}
            placeholder="如：人生管理系统"
            className="input flex-1"
          />
          <button onClick={handleAddPillar} disabled={!newPillar.trim()} className="btn btn-primary text-sm">
            <Plus size={14} /> 添加
          </button>
        </div>
        {pillars.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            还没有内容支柱
          </p>
        ) : (
          <div className="space-y-2">
            {pillars.map((pillar) => (
              <div key={pillar.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <div>
                  <span className="text-sm">{pillar.name}</span>
                  {pillar.isMock && <MockBadge className="ml-2" onClick={() => claimPillar(pillar)} />}
                  {pillar.description && (
                    <span className="text-xs ml-2" style={{ color: 'var(--color-text-tertiary)' }}>
                      {pillar.description}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeletePillar(pillar.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label={`删除支柱 ${pillar.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
