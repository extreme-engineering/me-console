import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Target, Sparkles, Compass, FileText, Star } from 'lucide-react';
import type { Vision } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import Modal from '../../components/Modal';
import MockBadge from '../../components/MockBadge';
import { isMockItem } from '../../lib/mockFlag';
import MindsetView from '../../components/MindsetView';
import { toast } from '../../stores/toastStore';

interface VisionItem extends Vision {
  mock?: boolean;
}

interface VisionResponse {
  vision?: VisionItem | null;
}

interface Framework {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  structure: string[];
  example: string;
  tips: string[];
  color: string;
}

const FRAMEWORKS: Framework[] = [
  {
    id: 'golden-circle',
    name: '黄金圈法则',
    icon: <Target className="w-5 h-5" />,
    description: '由 Simon Sinek 提出的激励性愿景框架，从内向外思考：为什么（Why）→ 怎么做（How）→ 做什么（What）',
    structure: [
      'Why - 我为什么做这件事？深层动机和信念',
      'How - 我如何实现？核心方法和价值观',
      'What - 我具体做什么？行动和产出',
    ],
    example: '我要帮助100万人找到人生使命，通过线上课程和社群陪伴，让每个人都能活出自己想要的人生。',
    tips: [
      '从"为什么"开始，而非"做什么"',
      '用愿景激励自己，而非单纯描述目标',
      '让内在动机驱动外在行动',
    ],
    color: 'var(--color-accent)',
  },
  {
    id: 'bhag',
    name: 'BHAG 大胆目标',
    icon: <Star className="w-5 h-5" />,
    description: 'Jim Collins 在《基业长青》中提出，设定震撼人心、10-30年完成的宏伟目标',
    structure: [
      '清晰可衡量的成果',
      '足够大胆以激励人心',
      '10-30年的时间跨度',
      '具有挑战性但可实现',
    ],
    example: '在2050年前，成为全球最具影响力的个人发展平台，帮助1亿人实现自我成长。',
    tips: [
      '目标要让人感到兴奋和恐惧并存',
      '至少需要10年才能实现',
      '描述成功后的世界是什么样子',
    ],
    color: 'var(--color-accent-muted)',
  },
  {
    id: '2nd-habit',
    name: '以终为始',
    icon: <Compass className="w-5 h-5" />,
    description: 'Stephen Covey《高效能人士的七个习惯》提出的可视化未来法，想象你80岁时的完美一天',
    structure: [
      '想象你80岁生日那天',
      '描述完美的一天：你在哪里？与谁在一起？在做什么？',
      '感受那份成就感和内心平静',
      '将这份愿景转化为今天的行动',
    ],
    example: '当我80岁时，我住在海边的小房子里，每天清晨写作，与家人共享晚餐，致力于帮助他人成长，内心充满平和与满足。',
    tips: [
      '想象你生命中最辉煌的时刻',
      '从未来视角审视今天的选择',
      '写下来，经常回顾和调整',
    ],
    color: 'var(--color-accent)',
  },
  {
    id: 'life-purpose',
    name: '人生使命宣言',
    icon: <FileText className="w-5 h-5" />,
    description: '找到你的人生使命：我是谁，我要做什么，我为谁而做，我如何做',
    structure: [
      '我是谁（身份）',
      '我要做什么（贡献）',
      '我为谁而做（服务对象）',
      '我如何做（价值观和方法）',
      '我的核心理念是什么',
    ],
    example: '我是一位教育者，致力于帮助年轻人发现他们的潜能，通过创新的学习方法，让每个人都能成为最好的自己。',
    tips: [
      '使命宣言不是名词，是动词',
      '回答"我能贡献什么"而非"我能得到什么"',
      '定期回顾，确保与时俱进',
    ],
    color: 'var(--color-success)',
  },
  {
    id: '101010',
    name: '1010愿景法',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Zig Ziglar 提出的多层次愿景设定，考虑10分钟、10个月、10年后的影响',
    structure: [
      '10分钟后：这项决定带来的第一个改变',
      '10个月后：实现目标的里程碑',
      '10年后：人生因此有何不同',
    ],
    example: '今天开始每天写作 → 10个月完成一本书 → 10年后成为有影响力的作家，改变读者的人生。',
    tips: [
      '让决策与长期愿景一致',
      '每个短期行动都指向长期目标',
      '定期审视中期里程碑',
    ],
    color: 'var(--color-warning)',
  },
  {
    id: 'okr-vision',
    name: 'OKR 愿景版',
    icon: <Target className="w-5 h-5" />,
    description: '将愿景与OKR目标管理结合，从长期愿景分解到季度目标',
    structure: [
      'O - Objective：鼓舞人心的目标',
      'KR1 - 关键结果1：可量化指标',
      'KR2 - 关键结果2：可量化指标',
      'KR3 - 关键结果3：可量化指标',
    ],
    example: 'O：在三年内成为行业专家\nKR1：完成100本专业书籍阅读\nKR2：建立500人专业网络\nKR3：发表50篇专业文章',
    tips: [
      '目标要定性，关键结果要定量',
      '每季度回顾并调整OKR',
      '愿景保持稳定，OKR灵活调整',
    ],
    color: 'var(--color-text-secondary)',
  },
  {
    id: 'legacy',
    name: '遗产思维',
    icon: <BookOpen className="w-5 h-5" />,
    description: '思考你希望留下什么，你想被后人如何铭记',
    structure: [
      '我希望被记住是因为什么？',
      '我想解决什么问题？',
      '我希望世界因我有何不同？',
      '我想传承什么给他人？',
    ],
    example: '我希望被记住是一位真诚帮助他人成长的人。我的使命是打破知识的壁垒，让更多人获得改变命运的智慧和勇气。',
    tips: [
      '思考你钦佩的人的遗产',
      '从"给予"而非"获得"的角度思考',
      '想象你的追悼会上会被如何评价',
    ],
    color: 'var(--color-accent-muted)',
  },
];

const PRACTICES = [
  { title: '具体化', desc: '用具体的词汇描绘愿景，而非模糊的概念' },
  { title: '情感化', desc: '愿景要能激发情感共鸣和热情' },
  { title: '可实现', desc: '保持雄心壮志，同时确保切实可行' },
  { title: '持续性', desc: '愿景是你长期坚持的方向标，而非短期目标' },
  { title: '利他性', desc: '融入为他人创造价值的元素' },
  { title: '可视化', desc: '想象愿景实现后的具体场景' },
];

export default function Vision() {
  const visionQuery = useApiQuery<VisionResponse>(['visions'], '/visions');
  const vision = visionQuery.data?.vision || null;
  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vision' | 'mindset'>('vision');

  const createVision = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/visions', data), [['visions']]);
  const updateVision = useApiMutation(({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/visions/${id}`, data), [['visions']]);

  const handleOpenCreate = () => {
    setContent('');
    setShowModal(true);
  };

  const handleOpenEdit = () => {
    setContent(vision?.content || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (vision) {
        await updateVision.mutateAsync({ id: vision.id, data: { content } });
      } else {
        await createVision.mutateAsync({ content, status: 'active' });
      }
      setShowModal(false);
    } catch {
      toast.error('操作失败，请重试');
    }

    finally {
      setSaving(false);
    }
  };

  const applyFramework = (framework: Framework) => {
    const exampleWithContext = `【${framework.name}】
${framework.example}

【框架要点】
${framework.structure.map((s, i) => `${i + 1}. ${s}`).join('\n')}

【我的愿景】
`;
    setContent(exampleWithContext);
    setSelectedFramework(framework.id);
    setShowModal(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (visionQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border border-slate-200 border-t-slate-900 rounded-full animate-spin" />
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
          愿景与价值观
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          人生愿景与心态格言，你的内在导航系统
        </p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <button
          onClick={() => setActiveTab('vision')}
          className={`px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'vision' ? 'font-medium' : ''}`}
          style={{
            backgroundColor: activeTab === 'vision' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'vision' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === 'vision' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          人生愿景
        </button>
        <button
          onClick={() => setActiveTab('mindset')}
          className={`px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'mindset' ? 'font-medium' : ''}`}
          style={{
            backgroundColor: activeTab === 'mindset' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'mindset' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === 'mindset' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          心态格言
        </button>
      </div>

      {activeTab === 'mindset' ? (
        <MindsetView />
      ) : (
      <>
      {/* Best Practices */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>愿景设定最佳实践</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PRACTICES.map((p) => (
            <div key={p.title} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'var(--color-ink-soft)' }}>
                <Sparkles size={12} style={{ color: 'var(--color-text-inverse)' }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{p.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Framework Selection */}
      <div className="mb-8">
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>选择愿景框架</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>选择一个框架作为参考，帮助你更好地构建愿景</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FRAMEWORKS.map((fw) => (
            <div key={fw.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedFramework(expandedFramework === fw.id ? null : fw.id)}
                className="w-full p-4 flex items-center gap-3 text-left transition-colors"
                style={{ backgroundColor: 'transparent' }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0`} style={{ backgroundColor: fw.color }}>
                  {fw.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{fw.name}</p>
                  <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{fw.description}</p>
                </div>
                <div style={{ color: 'var(--color-text-tertiary)' }}>
                  {expandedFramework === fw.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {expandedFramework === fw.id && (
                <div style={{ borderTop: '1px solid var(--color-border-light)' }}>
                  <div className="pt-4 space-y-4 px-4 pb-4">
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>框架结构</p>
                      <ul className="space-y-1">
                        {fw.structure.map((s, i) => (
                          <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                            <span style={{ color: 'var(--color-text-tertiary)' }}>{i + 1}.</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>示例</p>
                      <p className="text-xs p-3 rounded-lg italic" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>"{fw.example}"</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>写作提示</p>
                      <ul className="space-y-1">
                        {fw.tips.map((tip, i) => (
                          <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                            <span style={{ color: 'var(--color-success)' }}>•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={() => applyFramework(fw)}
                      className="w-full py-2.5 text-xs font-medium rounded-lg transition-opacity"
                      style={{ backgroundColor: fw.color, color: 'white' }}
                    >
                      使用此框架创建愿景
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Vision */}
      {!vision ? (
        <div className="card p-12 text-center" style={{ borderStyle: 'dashed' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="20" stroke="var(--color-border)" strokeWidth="1.5" fill="none"/>
              <circle cx="24" cy="24" r="12" stroke="var(--color-border)" strokeWidth="1" fill="none"/>
              <circle cx="24" cy="24" r="3" fill="var(--color-text-primary)"/>
              <line x1="24" y1="4" x2="24" y2="12" stroke="var(--color-text-primary)" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="24" y1="36" x2="24" y2="44" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="4" y1="24" x2="12" y2="24" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round"/>
              <line x1="36" y1="24" x2="44" y2="24" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>你还没有创建人生愿景</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>选择一个框架，开始构建你的愿景</p>
          <button onClick={handleOpenCreate} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建愿景
          </button>
        </div>
      ) : (
        <div className="card p-5 group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 2L12.5 7.5L18 8L14 12L15 18L10 15L5 18L6 12L2 8L7.5 7.5L10 2Z" fill="var(--color-text-primary)" fillOpacity="0.15" stroke="var(--color-text-primary)" strokeWidth="1" strokeLinejoin="round"/>
                  <circle cx="10" cy="10" r="2" fill="var(--color-text-primary)"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                  我的愿景
                  {isMockItem(vision) && (
                    <MockBadge
                      onClick={async () => {
                        await updateVision.mutateAsync({ id: vision.id, data: { mock: false } });
                      }}
                    />
                  )}
                </h3>
                <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  <span>版本 {vision.version || 1}</span>
                  <span>更新于 {formatDate(vision.updatedAt || vision.createdAt)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 13.4a2.2 2.2 0 0 1-.78-.98l-3.5-4.6a2 2 0 0 1 0-2.38l.64-.75a2.2 2.2 0 0 1 3.12-.06l2.28 2.54a2.2 2.2 0 0 1 .5 1.56l-1.08 2.86a2.2 2.2 0 0 1-1.9 1.22z" />
              </svg>
            </button>
          </div>
          <div className="pl-[52px]">
            <p className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{vision.content}</p>
          </div>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={vision ? '编辑愿景' : '创建愿景'}
        maxWidth="max-w-lg"
      >
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>愿景内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="input resize-none"
              placeholder="我理想中的生活是..."
            />
          </div>
          {selectedFramework && (
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              基于 <span style={{ color: 'var(--color-text-secondary)' }}>{FRAMEWORKS.find(f => f.id === selectedFramework)?.name}</span> 框架
            </p>
          )}
        </div>
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
          <button onClick={() => setShowModal(false)} className="flex-1 btn btn-ghost">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="flex-1 btn btn-primary"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </Modal>
      </>
      )}
    </div>
  );
}