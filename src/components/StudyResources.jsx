import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen, Plus, Edit, Trash2, Search, Save, X, Eye, EyeOff,
  Lock, Globe, FileText, Tag, Calendar, User, Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { studyResourcesAPI } from '../services/api';

// ─── 简易 Markdown 渲染器（不引入新依赖）───────────────────────────────────────
// 支持：# ## ### 标题；**粗体**；*斜体*；`行内代码`；```代码块```；
//      - / * 列表；> 引用；--- 分隔线；[text](url) 链接；段落换行
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  let s = escapeHtml(text);
  // 行内代码
  s = s.replace(/`([^`]+?)`/g, '<code style="padding:1px 5px;border-radius:4px;background:rgba(125,125,125,0.18);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.9em;">$1</code>');
  // 粗体
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  // 斜体
  s = s.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
  // 链接
  s = s.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:underline;">$1</a>');
  return s;
}

function markdownToHtml(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inCode = false;
  let codeBuf = [];
  let listBuf = [];
  let paraBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p style="margin:8px 0;line-height:1.7;">${paraBuf.map(renderInline).join('<br/>')}</p>`);
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        `<ul style="padding-left:22px;margin:8px 0;line-height:1.7;">${listBuf
          .map(li => `<li style="margin:2px 0;">${renderInline(li)}</li>`)
          .join('')}</ul>`
      );
      listBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw;

    // 代码块
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushPara(); flushList();
        out.push(
          `<pre style="background:rgba(125,125,125,0.14);padding:12px 14px;border-radius:8px;overflow:auto;margin:10px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.88em;line-height:1.55;"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
        );
        codeBuf = [];
        inCode = false;
      } else {
        flushPara(); flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // 空行 -> 段落切分
    if (!line.trim()) { flushPara(); flushList(); continue; }

    // 分隔线
    if (/^\s*---\s*$/.test(line)) {
      flushPara(); flushList();
      out.push('<hr style="border:none;border-top:1px solid rgba(125,125,125,0.3);margin:14px 0;"/>');
      continue;
    }

    // 引用
    const quoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      flushPara(); flushList();
      out.push(
        `<blockquote style="border-left:3px solid rgba(99,102,241,0.5);padding:6px 12px;margin:8px 0;color:inherit;opacity:0.85;background:rgba(99,102,241,0.06);border-radius:0 6px 6px 0;">${renderInline(quoteMatch[1])}</blockquote>`
      );
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushPara(); flushList();
      const level = headingMatch[1].length;
      const size = { 1: '1.55em', 2: '1.3em', 3: '1.1em', 4: '1em', 5: '0.95em', 6: '0.9em' }[level];
      const mt = level <= 2 ? '18px' : '14px';
      out.push(
        `<h${level} style="font-size:${size};font-weight:700;margin:${mt} 0 8px;line-height:1.3;">${renderInline(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    // 列表
    const listMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (listMatch) { flushPara(); listBuf.push(listMatch[1]); continue; }

    // 普通段落
    flushList();
    paraBuf.push(line);
  }

  // 收尾
  if (inCode && codeBuf.length) {
    out.push(
      `<pre style="background:rgba(125,125,125,0.14);padding:12px 14px;border-radius:8px;overflow:auto;margin:10px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.88em;line-height:1.55;"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
    );
  }
  flushPara(); flushList();

  return out.join('\n');
}

const MarkdownPreview = ({ content, emptyHint = '暂无内容' }) => {
  const html = useMemo(() => markdownToHtml(content || ''), [content]);
  if (!content || !content.trim()) {
    return <div style={{ opacity: 0.5, fontSize: 13 }}>{emptyHint}</div>;
  }
  return (
    <div
      className="jsa-md-preview"
      style={{ fontSize: 14, wordBreak: 'break-word' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// ─── 主组件 ───────────────────────────────────────────────────────────────────
const StudyResources = () => {
  const { user, showNotification } = useApp();
  const { isDark, tokens, glassEnabled } = useTheme();

  const canEdit = user?.role === 'admin' || user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  // 玻璃/实色卡片样式
  const gcs = glassEnabled ? {
    background: tokens.colors.surface.glass,
    backdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
    WebkitBackdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
    border: `1px solid ${tokens.colors.border.hairline}`,
    boxShadow: `${tokens.shadow.elevation}, ${tokens.shadow.innerHighlight}`,
    borderRadius: `${tokens.radius.card}px`,
  } : {
    background: tokens.colors.surface.solid,
    border: `1px solid ${tokens.colors.border.subtle}`,
    borderRadius: `${tokens.radius.card}px`,
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    border: `1px solid ${tokens.colors.border.subtle}`,
    color: tokens.colors.text.primary,
    fontSize: 14,
    outline: 'none',
  };

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterVisibility, setFilterVisibility] = useState('all'); // all | public | private（仅老师/管理员）

  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create'); // create | edit
  const [editorForm, setEditorForm] = useState({
    id: null, title: '', content: '', category: '', tags: [], is_public: false,
  });
  const [editorPreview, setEditorPreview] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── 加载列表 ───────────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (!isStudent && filterVisibility === 'public') params.is_public = '1';
      if (!isStudent && filterVisibility === 'private') params.is_public = '0';
      const data = await studyResourcesAPI.list(params);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterVisibility, isStudent]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // 分类选项（从数据中动态聚合）
  const categoryOptions = useMemo(() => {
    const set = new Set();
    list.forEach(x => { if (x.category) set.add(x.category); });
    return Array.from(set).sort();
  }, [list]);

  // 过滤后的最终列表
  const filtered = useMemo(() => {
    return list.filter(x => {
      if (filterCategory !== 'all' && x.category !== filterCategory) return false;
      return true;
    });
  }, [list, filterCategory]);

  const selected = useMemo(
    () => (selectedId ? filtered.find(x => x.id === selectedId) || list.find(x => x.id === selectedId) : null),
    [selectedId, filtered, list]
  );

  // 当选中项消失（比如删除后）自动清空
  useEffect(() => {
    if (selectedId && !list.some(x => x.id === selectedId)) setSelectedId(null);
  }, [list, selectedId]);

  // ─── 操作：新建/编辑/删除/切换公开 ──────────────────────────────────────────
  const openCreate = () => {
    setEditorMode('create');
    setEditorForm({ id: null, title: '', content: '', category: '', tags: [], is_public: false });
    setEditorPreview(true);
    setEditorOpen(true);
  };
  const openEdit = (item) => {
    setEditorMode('edit');
    setEditorForm({
      id: item.id,
      title: item.title || '',
      content: item.content || '',
      category: item.category || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      is_public: !!item.is_public,
    });
    setEditorPreview(true);
    setEditorOpen(true);
  };

  const saveResource = async () => {
    if (!editorForm.title.trim()) {
      showNotification?.('请填写标题', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editorForm.title.trim(),
        content: editorForm.content,
        category: editorForm.category.trim(),
        tags: editorForm.tags,
        is_public: !!editorForm.is_public,
      };
      if (editorMode === 'create') {
        const created = await studyResourcesAPI.create(payload);
        showNotification?.('资料已创建', 'success');
        setEditorOpen(false);
        await fetchList();
        if (created?.id) setSelectedId(created.id);
      } else {
        await studyResourcesAPI.update(editorForm.id, payload);
        showNotification?.('资料已更新', 'success');
        setEditorOpen(false);
        await fetchList();
        setSelectedId(editorForm.id);
      }
    } catch (e) {
      showNotification?.(e?.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (item) => {
    if (!window.confirm(`确定删除"${item.title}"吗？此操作不可撤销。`)) return;
    try {
      await studyResourcesAPI.delete(item.id);
      showNotification?.('已删除', 'success');
      if (selectedId === item.id) setSelectedId(null);
      await fetchList();
    } catch (e) {
      showNotification?.(e?.message || '删除失败', 'error');
    }
  };

  const toggleVisibility = async (item) => {
    try {
      await studyResourcesAPI.setVisibility(item.id, !item.is_public);
      showNotification?.(item.is_public ? '已设为私密' : '已公开', 'success');
      await fetchList();
    } catch (e) {
      showNotification?.(e?.message || '操作失败', 'error');
    }
  };

  // ─── UI 片段 ────────────────────────────────────────────────────────────────
  const Badge = ({ children, color }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: color || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
      color: tokens.colors.text.secondary,
    }}>
      {children}
    </span>
  );

  return (
    <div className="space-y-4" style={{ color: tokens.colors.text.primary }}>
      {/* 顶部标题 + 操作 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
            border: `1px solid ${tokens.colors.border.subtle}`,
          }}>
            <BookOpen size={20} style={{ color: tokens.colors.accent.primary }} />
          </div>
          <div>
            <h2 className="text-xl font-bold">塾内备考资料库</h2>
            <p className="text-xs mt-0.5" style={{ color: tokens.colors.text.muted }}>
              {isStudent
                ? '仅显示老师公开的资料，可在线阅读'
                : '老师可上传/在线编辑 Markdown 资料，可切换公开/私密'}
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${tokens.colors.accent.primary}, ${tokens.colors.accent.secondary || tokens.colors.accent.primary})`,
              color: '#fff',
              fontSize: 14,
            }}
          >
            <Plus size={16} /> 新建资料
          </button>
        )}
      </div>

      {/* 搜索/筛选条 */}
      <div className="p-3 flex flex-wrap items-center gap-2" style={gcs}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 min-w-[200px]"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', border: `1px solid ${tokens.colors.border.subtle}` }}>
          <Search size={15} style={{ color: tokens.colors.text.muted }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题或正文..."
            className="flex-1 bg-transparent outline-none"
            style={{ color: tokens.colors.text.primary, fontSize: 14 }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter size={14} style={{ color: tokens.colors.text.muted }} />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 13,
            }}
          >
            <option value="all">全部分类</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {canEdit && (
          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            style={{
              ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 13,
            }}
          >
            <option value="all">全部可见性</option>
            <option value="public">仅公开</option>
            <option value="private">仅私密</option>
          </select>
        )}
      </div>

      {/* 主体布局：左列表 + 右预览 */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(280px,340px) 1fr' }}>
        {/* 左列表 */}
        <div className="p-2" style={{ ...gcs, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {loading ? (
            <div className="p-6 text-center text-sm" style={{ color: tokens.colors.text.muted }}>加载中...</div>
          ) : error ? (
            <div className="p-4 text-sm" style={{ color: tokens.colors.accent.danger }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: tokens.colors.text.muted }}>
              {searchQuery || filterCategory !== 'all' ? '没有匹配的资料' : (canEdit ? '还没有资料，点击右上"新建资料"开始' : '老师还未公开任何资料')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(item => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className="w-full text-left p-3 rounded-lg transition-all"
                    style={{
                      background: active
                        ? (isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.08)')
                        : 'transparent',
                      border: `1px solid ${active ? tokens.colors.accent.primary : 'transparent'}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ fontSize: 14 }}>{item.title}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap" style={{ fontSize: 11, color: tokens.colors.text.muted }}>
                          {item.category && <Badge>{item.category}</Badge>}
                          {item.is_public
                            ? <Badge color={isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)'}><Globe size={10} /> 公开</Badge>
                            : <Badge color={isDark ? 'rgba(234,179,8,0.18)' : 'rgba(234,179,8,0.12)'}><Lock size={10} /> 私密</Badge>}
                        </div>
                        <div className="mt-1 truncate" style={{ fontSize: 11, color: tokens.colors.text.muted }}>
                          {item.updated_by_name || item.author_name || '未知'} · {(item.updated_at || item.created_at || '').toString().slice(0, 16).replace('T', ' ')}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 右预览 */}
        <div className="p-5" style={{ ...gcs, minHeight: 360 }}>
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-20">
              <FileText size={36} style={{ color: tokens.colors.text.muted }} />
              <div style={{ color: tokens.colors.text.muted, fontSize: 14 }}>
                从左侧选择一份资料查看详情
              </div>
            </div>
          ) : (
            <>
              {/* 头部 */}
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold break-words">{selected.title}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap" style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                    {selected.category && <Badge><Tag size={10} /> {selected.category}</Badge>}
                    {selected.is_public
                      ? <Badge color={isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)'}><Globe size={10} /> 公开</Badge>
                      : <Badge color={isDark ? 'rgba(234,179,8,0.18)' : 'rgba(234,179,8,0.12)'}><Lock size={10} /> 私密</Badge>}
                    <Badge><User size={10} /> {selected.author_name || '未知'}</Badge>
                    <Badge><Calendar size={10} /> {(selected.updated_at || selected.created_at || '').toString().slice(0, 16).replace('T', ' ')}</Badge>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleVisibility(selected)}
                      title={selected.is_public ? '切换为私密' : '切换为公开'}
                      className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:opacity-80 transition-all"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        color: tokens.colors.text.primary,
                      }}
                    >
                      {selected.is_public ? <><EyeOff size={13} /> 转私密</> : <><Eye size={13} /> 公开</>}
                    </button>
                    <button
                      onClick={() => openEdit(selected)}
                      className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:opacity-80 transition-all"
                      style={{
                        background: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)',
                        border: `1px solid ${tokens.colors.accent.primary}`,
                        color: tokens.colors.accent.primary,
                      }}
                    >
                      <Edit size={13} /> 编辑
                    </button>
                    <button
                      onClick={() => deleteResource(selected)}
                      className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:opacity-80 transition-all"
                      style={{
                        background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${tokens.colors.accent.danger}`,
                        color: tokens.colors.accent.danger,
                      }}
                    >
                      <Trash2 size={13} /> 删除
                    </button>
                  </div>
                )}
              </div>

              <div style={{ borderTop: `1px solid ${tokens.colors.border.hairline}`, margin: '10px 0 14px' }} />

              {/* Markdown 正文 */}
              <MarkdownPreview content={selected.content} emptyHint="该资料还没有正文内容" />
            </>
          )}
        </div>
      </div>

      {/* 编辑器 Modal */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditorOpen(false); }}
        >
          <div
            className="w-full max-w-5xl flex flex-col"
            style={{
              ...gcs,
              maxHeight: '92vh',
              background: tokens.colors.surface.solid,
              borderRadius: tokens.radius.card,
            }}
          >
            {/* 顶部 */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${tokens.colors.border.hairline}` }}>
              <div className="font-semibold flex items-center gap-2">
                <BookOpen size={16} style={{ color: tokens.colors.accent.primary }} />
                {editorMode === 'create' ? '新建资料' : '编辑资料'}
              </div>
              <button onClick={() => setEditorOpen(false)} className="p-1 hover:opacity-70">
                <X size={18} />
              </button>
            </div>

            {/* 表单字段 */}
            <div className="p-5 space-y-3 overflow-y-auto" style={{ flex: 1 }}>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>标题 *</label>
                <input
                  value={editorForm.title}
                  onChange={(e) => setEditorForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="例如：EJU 物理复习要点（2026）"
                  style={inputStyle}
                />
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>分类</label>
                  <input
                    value={editorForm.category}
                    onChange={(e) => setEditorForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="EJU / 日语 / 面试 / 留学生试验 ..."
                    list="study-resource-categories"
                    style={inputStyle}
                  />
                  <datalist id="study-resource-categories">
                    {categoryOptions.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>标签（逗号分隔）</label>
                  <input
                    value={editorForm.tags.join(', ')}
                    onChange={(e) => setEditorForm(f => ({
                      ...f,
                      tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                    }))}
                    placeholder="例如：物理, 2026, 真题"
                    style={inputStyle}
                  />
                </div>
                <div className="flex items-end">
                  <label
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                    style={{
                      background: editorForm.is_public
                        ? (isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.1)')
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      border: `1px solid ${editorForm.is_public ? tokens.colors.accent.success || '#10b981' : tokens.colors.border.subtle}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!editorForm.is_public}
                      onChange={(e) => setEditorForm(f => ({ ...f, is_public: e.target.checked }))}
                    />
                    {editorForm.is_public ? <Globe size={14} /> : <Lock size={14} />}
                    <span style={{ fontSize: 13 }}>{editorForm.is_public ? '公开（学生可见）' : '私密（仅老师可见）'}</span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: tokens.colors.text.secondary }}>
                    正文内容（Markdown）
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: tokens.colors.text.muted }}>
                    <input type="checkbox" checked={editorPreview} onChange={(e) => setEditorPreview(e.target.checked)} />
                    实时预览
                  </label>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: editorPreview ? '1fr 1fr' : '1fr' }}>
                  <textarea
                    value={editorForm.content}
                    onChange={(e) => setEditorForm(f => ({ ...f, content: e.target.value }))}
                    placeholder={`支持 Markdown：\n# 一级标题\n## 二级标题\n**粗体**  *斜体*  \`行内代码\`\n- 列表项 1\n- 列表项 2\n> 引用\n\n\`\`\`\n代码块\n\`\`\`\n[链接](https://example.com)`}
                    style={{
                      ...inputStyle,
                      minHeight: 360,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 13,
                      lineHeight: 1.6,
                      resize: 'vertical',
                    }}
                  />
                  {editorPreview && (
                    <div
                      className="p-3 rounded-lg overflow-auto"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        minHeight: 360,
                        maxHeight: 560,
                      }}
                    >
                      <MarkdownPreview content={editorForm.content} emptyHint="预览区（边写边看）" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部操作 */}
            <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${tokens.colors.border.hairline}` }}>
              <button
                onClick={() => setEditorOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm hover:opacity-80 transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  color: tokens.colors.text.primary,
                }}
              >
                取消
              </button>
              <button
                onClick={saveResource}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 font-medium transition-all hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${tokens.colors.accent.primary}, ${tokens.colors.accent.secondary || tokens.colors.accent.primary})`,
                  color: '#fff',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <Save size={14} />
                {saving ? '保存中...' : (editorMode === 'create' ? '创建' : '保存')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyResources;
