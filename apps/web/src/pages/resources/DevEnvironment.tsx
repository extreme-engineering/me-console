import { useState, useRef } from 'react';
import { toast } from '../../stores/toastStore';

interface EnvItem {
  name: string;
  type: string;
  version: string;
  description: string;
}

interface CategoryData {
  title: string;
  items: EnvItem[];
}

export default function DevEnvironment() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EnvItem | null>(null);
  const [editForm, setEditForm] = useState<EnvItem>({ name: '', type: '', version: '', description: '' });
  const [fileName, setFileName] = useState('');
  const [importTime, setImportTime] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parseMarkdown = (content: string): CategoryData[] => {
    const sections: CategoryData[] = [];
    const lines = content.split('\n');
    let currentCategory: CategoryData | null = null;
    let inTable = false;
    let headerCols: string[] = [];

    for (const line of lines) {
      if (!line.trim()) { inTable = false; continue; }
      if (line.startsWith('### ') && !line.includes('|')) {
        if (currentCategory && currentCategory.items.length > 0) sections.push(currentCategory);
        currentCategory = { title: line.replace('### ', '').trim(), items: [] };
        inTable = false; headerCols = [];
      } else if (line.includes('|') && line.includes('---')) {
        inTable = true; headerCols = [];
      } else if (inTable && line.includes('|')) {
        const trimmedLine = line.trim();
        const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c.length > 0 && !/^-+$/.test(c));
        if (cells.length === 0) continue;

        const headerKeywords = ['名称', '类型', '版本', '用途', '项目', '简介', '详情', '包名'];
        const isHeader = cells.some(c => headerKeywords.some(k => c.includes(k)));

        if (isHeader && headerCols.length === 0) {
          headerCols = cells.map(c => {
            const lower = c.toLowerCase();
            if (lower.includes('名称') || lower.includes('包名') || lower.includes('项')) return 'name';
            if (lower.includes('类型') || lower.includes('类')) return 'type';
            if (lower.includes('版本') || lower.includes('版')) return 'version';
            if (lower.includes('用途') || lower.includes('简介') || lower.includes('详情') || lower.includes('说')) return 'description';
            return c;
          });
        } else {
          const item: EnvItem = { name: '', type: '', version: '', description: '' };
          if (headerCols.length > 0) {
            cells.forEach((cell, i) => {
              const key = headerCols[i];
              if (key === 'name') item.name = cell;
              else if (key === 'type') item.type = cell;
              else if (key === 'version') item.version = cell;
              else if (key === 'description') item.description = cell;
            });
          }
          if (!item.name && cells[0]) item.name = cells[0];
          if (!item.type && cells[1]) item.type = cells[1];
          if (!item.version && cells[2]) item.version = cells[2];
          if (!item.description && cells[3]) item.description = cells[3];
          if (item.name) currentCategory?.items.push(item);
        }
      } else {
        inTable = false;
      }
    }
    if (currentCategory && currentCategory.items.length > 0) sections.push(currentCategory);
    return sections;
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const sections = parseMarkdown(content);
        const timeMatch = content.match(/生成时间：(\d{4}-\d{2}-\d{2})/);
        if (timeMatch) setImportTime(timeMatch[1]);
        setCategories(sections);
        if (sections.length > 0) setSelectedCategory(sections[0].title);
        else alert('未能解析出有效数据，请检查文件格式');
      } catch {
        toast.error('解析失败');
        alert('文件解析失败');
      }
    };
    reader.readAsText(file);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setEditForm({ name: '', type: '运行时', version: '', description: '' });
    setShowEditModal(true);
  };

  const handleEdit = (item: EnvItem) => {
    setEditingItem(item);
    setEditForm({ ...item });
    setShowEditModal(true);
  };

  const handleDelete = (name: string) => {
    if (!confirm(`确定要删除 "${name}" 吗？`)) return;
    setCategories(prev => prev.map(cat => {
      if (cat.title === selectedCategory) return { ...cat, items: cat.items.filter(item => item.name !== name) };
      return cat;
    }));
  };

  const handleSave = () => {
    if (!editForm.name.trim()) { alert('请输入名称'); return; }
    setCategories(prev => prev.map(cat => {
      if (cat.title === selectedCategory) {
        if (editingItem) return { ...cat, items: cat.items.map(item => item.name === editingItem.name ? { ...editForm } : item) };
        else return { ...cat, items: [...cat.items, { ...editForm }] };
      }
      return cat;
    }));
    setShowEditModal(false);
  };

  const generateMarkdown = (): string => {
    let output = `## 本机开发环境梳理报告\n\n生成时间：${importTime || new Date().toISOString().split('T')[0]}\n\n---\n\n`;
    for (const cat of categories) {
      output += `### ${cat.title}\n\n| 名称 | 类型 | 版本 | 用途简介 |\n|------|------|------|----------|\n`;
      for (const item of cat.items) {
        output += `| ${item.name} | ${item.type} | ${item.version} | ${item.description} |\n`;
      }
      output += '\n---\n\n';
    }
    return output;
  };

  const handleExport = () => {
    const content = generateMarkdown();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'dev-environment-report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentItems = categories.find(c => c.title === selectedCategory)?.items || [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-light text-slate-900 tracking-tight">本地开发环境</h1>
          <p className="text-sm text-slate-400 mt-1">导入、编辑、导出开发环境报告</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".md" onChange={handleFileImport} ref={fileRef} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-[var(--color-surface)] border border-slate-200 rounded-lg hover:border-slate-300 hover:text-slate-900 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            导入 MD
          </button>
          {categories.length > 0 && (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              导出 MD
            </button>
          )}
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 mb-1">暂无数据</p>
          <p className="text-xs text-slate-400 mb-4">点击按钮加载开发环境报告文件</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] rounded-lg transition-all"
          >
            导入开发环境报告
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat.title}
                onClick={() => setSelectedCategory(cat.title)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat.title
                    ? 'bg-[var(--color-ink-soft)] text-white'
                    : 'bg-[var(--color-surface)] text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat.title} ({cat.items.length})
              </button>
            ))}
          </div>

          <div className="flex justify-end mb-4">
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加项目
            </button>
          </div>

          <div className="bg-[var(--color-surface)] rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-widest">名称</th>
                  <th className="px-5 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-widest">类型</th>
                  <th className="px-5 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-widest">版本</th>
                  <th className="px-5 py-3 text-left text-[10px] font-medium text-slate-400 uppercase tracking-widest">用途简介</th>
                  <th className="px-5 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{item.name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{item.type}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 tabular-nums">{item.version || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{item.description || '-'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 13.4a2.2 2.2 0 0 1-.78-.98l-3.5-4.6a2 2 0 0 1 0-2.38l.64-.75a2.2 2.2 0 0 1 3.12-.06l2.28 2.54a2.2 2.2 0 0 1 .5 1.56l-1.08 2.86a2.2 2.2 0 0 1-1.9 1.22z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(item.name)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentItems.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">暂无项目</div>
            )}
          </div>
        </>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px]" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] w-full max-w-md overflow-hidden" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="px-6 py-5 border-b border-slate-50">
              <h2 className="text-lg font-medium text-slate-900">{editingItem ? '编辑项目' : '添加项目'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">名称 *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:border-slate-200 focus:bg-[var(--color-surface)] transition-all" placeholder="例如: Node.js" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">类型</label>
                <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:border-slate-200 focus:bg-[var(--color-surface)] transition-all">
                  <option value="运行时">运行时</option>
                  <option value="应用">应用</option>
                  <option value="包管理器">包管理器</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">版本</label>
                <input type="text" value={editForm.version} onChange={(e) => setEditForm({ ...editForm, version: e.target.value })} className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:border-slate-200 focus:bg-[var(--color-surface)] transition-all" placeholder="例如: 25.9.0" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">用途简介</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:border-slate-200 focus:bg-[var(--color-surface)] transition-all resize-none" placeholder="简述用途..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all">取消</button>
                <button onClick={handleSave} className="flex-1 px-4 py-3 text-sm font-medium text-white bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] rounded-lg transition-all">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
