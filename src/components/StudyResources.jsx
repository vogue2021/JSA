import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen, Plus, Edit, Trash2, Search, Save, X, Eye, EyeOff,
  Lock, Globe, FileText, Tag, Calendar, User, Filter,
  Link as LinkIcon, ExternalLink, FileEdit,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { studyResourcesAPI } from '../services/api';

// ─── 轻量 Markdown 渲染器（零新依赖）─────────────────────────────────────────
// 支持：
//   标题 # ~ ######、段落、强制换行（行尾两空格 / 单独 <br>）
//   粗体 **x** / __x__、斜体 *x* / _x_、粗斜体 ***x***、删除线 ~~x~~
//   行内代码 `x`、代码块 ```x``` 或 ~~~x~~~（可带语言标签）
//   无序列表 - / * / +（支持按缩进多级嵌套）
//   有序列表 1. 2.（支持多级）
//   任务列表 - [ ] / - [x]
//   引用 >、分隔线 --- / ***、链接 [text](url)、图片 ![alt](url)
//   裸 URL 自动识别
//   GFM 表格：|h1|h2|  换行  |---|---|  换行  |c1|c2|
// ───────────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 行内元素渲染（text 已是 escaped html 前的原文）
function renderInline(text) {
  if (text == null) return '';
  // 先提取"行内代码"占位，避免里面的内容被其他规则误伤
  const codeStore = [];
  let s = String(text).replace(/`([^`\n]+?)`/g, (_, code) => {
    codeStore.push(code);
    return `\u0000CODE${codeStore.length - 1}\u0000`;
  });

  // 再提取图片与链接（原文里可能有 >、&），它们的 alt/url 需要转义
  const linkStore = [];
  // 图片 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^\s)]+?)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
    linkStore.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''} style="max-width:100%;border-radius:6px;margin:6px 0;" />`);
    return `\u0000LINK${linkStore.length - 1}\u0000`;
  });
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+)\)/g, (_, label, url) => {
    linkStore.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:underline;">${escapeHtml(label)}</a>`);
    return `\u0000LINK${linkStore.length - 1}\u0000`;
  });

  // 现在对剩余文本做 HTML 转义
  s = escapeHtml(s);

  // 粗斜体 ***x***（需在粗体/斜体前处理）
  s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // 粗体
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
  // 斜体
  s = s.replace(/(?<![*\w])\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
  s = s.replace(/(?<![_\w])_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
  // 删除线
  s = s.replace(/~~([^~\n]+?)~~/g, '<del style="opacity:0.7;">$1</del>');

  // 裸 URL 自动链接（不在已占位的链接/图片内）
  s = s.replace(/(^|[^"'>\w])((?:https?:\/\/)[^\s<"')]+)/g, (m, pre, url) => {
    // 清理末尾常见标点
    const trail = url.match(/[.,;:!?)\]]+$/)?.[0] || '';
    const clean = trail ? url.slice(0, -trail.length) : url;
    return `${pre}<a href="${clean}" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:underline;">${clean}</a>${trail}`;
  });

  // 行尾两空格 -> <br/>
  s = s.replace(/  \n?$/g, '<br/>');

  // 占位还原
  s = s.replace(/\u0000LINK(\d+)\u0000/g, (_, i) => linkStore[Number(i)]);
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_, i) =>
    `<code style="padding:1px 5px;border-radius:4px;background:rgba(125,125,125,0.18);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.9em;">${escapeHtml(codeStore[Number(i)])}</code>`
  );
  return s;
}

// GFM 表格对齐解析：| :--- | :---: | ---: |
function parseAlignRow(row) {
  const cells = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
  const aligns = cells.map(c => {
    if (/^:-+:$/.test(c)) return 'center';
    if (/^-+:$/.test(c)) return 'right';
    if (/^:-+$/.test(c)) return 'left';
    if (/^-+$/.test(c)) return null;
    return null;
  });
  // 只有每列都匹配了对齐格式才算表格分隔行
  const allValid = cells.every(c => /^:?-+:?$/.test(c));
  return allValid ? aligns : null;
}

function splitTableRow(line) {
  // 支持转义的 \| ：先占位后切分
  const placeholder = '\u0001';
  const tmp = line.replace(/\\\|/g, placeholder);
  const body = tmp.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split('|').map(s => s.trim().replace(new RegExp(placeholder, 'g'), '|'));
}

function markdownToHtml(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];

  // 列表栈：每层 { type: 'ul'|'ol', indent, html: [] }
  let listStack = [];
  let paraBuf = [];
  let inCode = false;
  let codeLang = '';
  let codeBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p style="margin:8px 0;line-height:1.75;">${paraBuf.map(renderInline).join('<br/>')}</p>`);
      paraBuf = [];
    }
  };
  const closeListsToDepth = (depth) => {
    while (listStack.length > depth) {
      const top = listStack.pop();
      const tag = top.type;
      const html = `<${tag} style="padding-left:22px;margin:6px 0;line-height:1.75;">${top.html.join('')}</${tag}>`;
      if (listStack.length > 0) {
        // 附加到父级列表最后一个 <li> 中
        const parent = listStack[listStack.length - 1];
        const last = parent.html.length - 1;
        if (last >= 0) {
          // 把子列表嵌入最后一个 li
          parent.html[last] = parent.html[last].replace(/<\/li>$/, `${html}</li>`);
        } else {
          parent.html.push(html);
        }
      } else {
        out.push(html);
      }
    }
  };
  const flushAllLists = () => closeListsToDepth(0);

  const appendListItem = (item, indent, ordered) => {
    // 根据缩进维护栈：indent 转换成 level（每 2 空格一个 level）
    const level = Math.floor(indent / 2);
    // 关闭比当前 level 更深的
    closeListsToDepth(level + 1);
    // 如果当前深度没有列表或类型不同，开新列表
    const curTop = listStack[level];
    const wantType = ordered ? 'ol' : 'ul';
    if (!curTop || curTop.type !== wantType) {
      // 先关掉同层及以下，不影响父层
      closeListsToDepth(level);
      listStack.push({ type: wantType, indent, html: [] });
    }
    listStack[listStack.length - 1].html.push(`<li style="margin:2px 0;">${renderInline(item)}</li>`);
  };

  const appendTaskItem = (item, indent, checked) => {
    const level = Math.floor(indent / 2);
    closeListsToDepth(level + 1);
    const curTop = listStack[level];
    if (!curTop || curTop.type !== 'ul') {
      closeListsToDepth(level);
      listStack.push({ type: 'ul', indent, html: [] });
    }
    const box = checked
      ? '<span style="display:inline-block;width:14px;height:14px;border:1px solid #10b981;background:#10b981;color:#fff;border-radius:3px;font-size:11px;line-height:12px;text-align:center;margin-right:6px;vertical-align:-2px;">✓</span>'
      : '<span style="display:inline-block;width:14px;height:14px;border:1.5px solid rgba(125,125,125,0.6);border-radius:3px;margin-right:6px;vertical-align:-2px;"></span>';
    listStack[listStack.length - 1].html.push(
      `<li style="margin:2px 0;list-style:none;margin-left:-18px;">${box}${renderInline(item)}</li>`
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ─── 代码块围栏 ``` / ~~~ ───
    const fenceMatch = line.match(/^(\s*)(```+|~~~+)\s*(\S*)\s*$/);
    if (fenceMatch) {
      if (inCode) {
        flushPara(); flushAllLists();
        out.push(
          `<pre style="background:rgba(125,125,125,0.14);padding:12px 14px;border-radius:8px;overflow:auto;margin:10px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.88em;line-height:1.55;"><code${codeLang ? ` class="lang-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
        );
        codeBuf = [];
        codeLang = '';
        inCode = false;
      } else {
        flushPara(); flushAllLists();
        inCode = true;
        codeLang = fenceMatch[3] || '';
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // ─── 空行 ───
    if (!line.trim()) {
      flushPara();
      flushAllLists();
      continue;
    }

    // ─── 分隔线 ───
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushPara(); flushAllLists();
      out.push('<hr style="border:none;border-top:1px solid rgba(125,125,125,0.3);margin:14px 0;"/>');
      continue;
    }

    // ─── 引用 ───
    const quoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      flushPara(); flushAllLists();
      // 合并连续的引用行
      const quoteLines = [quoteMatch[1]];
      while (i + 1 < lines.length) {
        const nm = lines[i + 1].match(/^\s*>\s?(.*)$/);
        if (nm) { quoteLines.push(nm[1]); i++; } else break;
      }
      out.push(
        `<blockquote style="border-left:3px solid rgba(99,102,241,0.5);padding:6px 12px;margin:8px 0;color:inherit;opacity:0.9;background:rgba(99,102,241,0.06);border-radius:0 6px 6px 0;">${quoteLines.map(renderInline).join('<br/>')}</blockquote>`
      );
      continue;
    }

    // ─── 标题 ───
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushPara(); flushAllLists();
      const level = headingMatch[1].length;
      const size = { 1: '1.55em', 2: '1.3em', 3: '1.12em', 4: '1em', 5: '0.95em', 6: '0.9em' }[level];
      const mt = level <= 2 ? '20px' : '14px';
      const borderBottom = level <= 2 ? `border-bottom:1px solid rgba(125,125,125,0.25);padding-bottom:4px;` : '';
      out.push(
        `<h${level} style="font-size:${size};font-weight:700;margin:${mt} 0 8px;line-height:1.3;${borderBottom}">${renderInline(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    // ─── GFM 表格 ───
    // 检查 当前行 && 下一行 是否构成表头 + 分隔
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length) {
      const sep = lines[i + 1];
      const aligns = /^\s*\|?\s*:?-+:?/.test(sep) ? parseAlignRow(sep) : null;
      if (aligns) {
        flushPara(); flushAllLists();
        const headerCells = splitTableRow(line);
        i++; // 跳过分隔行
        const bodyRows = [];
        while (i + 1 < lines.length && /^\s*\|.+\|\s*$/.test(lines[i + 1])) {
          i++;
          bodyRows.push(splitTableRow(lines[i]));
        }
        const thead = `<thead><tr>${headerCells.map((c, k) => {
          const a = aligns[k] ? ` style="text-align:${aligns[k]};"` : '';
          return `<th${a} style="padding:6px 10px;border:1px solid rgba(125,125,125,0.3);background:rgba(125,125,125,0.12);font-weight:600;${aligns[k] ? `text-align:${aligns[k]};` : ''}">${renderInline(c)}</th>`;
        }).join('')}</tr></thead>`;
        const tbody = `<tbody>${bodyRows.map(row =>
          `<tr>${row.map((c, k) => {
            const a = aligns[k] ? `text-align:${aligns[k]};` : '';
            return `<td style="padding:6px 10px;border:1px solid rgba(125,125,125,0.25);${a}">${renderInline(c)}</td>`;
          }).join('')}</tr>`
        ).join('')}</tbody>`;
        out.push(
          `<div style="overflow-x:auto;margin:10px 0;"><table style="border-collapse:collapse;width:auto;min-width:100%;font-size:13.5px;line-height:1.55;">${thead}${tbody}</table></div>`
        );
        continue;
      }
    }

    // ─── 任务列表 - [ ] / - [x] ───
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      flushPara();
      appendTaskItem(taskMatch[3], taskMatch[1].length, /[xX]/.test(taskMatch[2]));
      continue;
    }

    // ─── 无序列表 ───
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ulMatch) {
      flushPara();
      appendListItem(ulMatch[2], ulMatch[1].length, false);
      continue;
    }

    // ─── 有序列表 ───
    const olMatch = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (olMatch) {
      flushPara();
      appendListItem(olMatch[2], olMatch[1].length, true);
      continue;
    }

    // ─── 普通段落 ───
    flushAllLists();
    paraBuf.push(line);
  }

  // 收尾
  if (inCode && codeBuf.length) {
    out.push(
      `<pre style="background:rgba(125,125,125,0.14);padding:12px 14px;border-radius:8px;overflow:auto;margin:10px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.88em;line-height:1.55;"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
    );
  }
  flushPara();
  flushAllLists();

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

// 简易 URL 校验
const isValidHttpUrl = (u) => /^https?:\/\//i.test(String(u || '').trim());

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
  const [filterVisibility, setFilterVisibility] = useState('all');
  const [filterType, setFilterType] = useState('all'); // all | markdown | link

  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editorForm, setEditorForm] = useState({
    id: null, title: '', content: '', category: '', tags: [], is_public: false,
    resource_type: 'markdown', url: '', description: '',
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

  const categoryOptions = useMemo(() => {
    const set = new Set();
    list.forEach(x => { if (x.category) set.add(x.category); });
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter(x => {
      if (filterCategory !== 'all' && x.category !== filterCategory) return false;
      if (filterType !== 'all' && (x.resource_type || 'markdown') !== filterType) return false;
      return true;
    });
  }, [list, filterCategory, filterType]);

  const selected = useMemo(
    () => (selectedId ? filtered.find(x => x.id === selectedId) || list.find(x => x.id === selectedId) : null),
    [selectedId, filtered, list]
  );

  useEffect(() => {
    if (selectedId && !list.some(x => x.id === selectedId)) setSelectedId(null);
  }, [list, selectedId]);

  // ─── 操作 ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditorMode('create');
    setEditorForm({
      id: null, title: '', content: '', category: '', tags: [], is_public: false,
      resource_type: 'markdown', url: '', description: '',
    });
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
      resource_type: item.resource_type === 'link' ? 'link' : 'markdown',
      url: item.url || '',
      description: item.description || '',
    });
    setEditorPreview(true);
    setEditorOpen(true);
  };

  const saveResource = async () => {
    if (!editorForm.title.trim()) {
      showNotification?.('请填写标题', 'warning');
      return;
    }
    if (editorForm.resource_type === 'link') {
      if (!editorForm.url.trim()) {
        showNotification?.('请填写资料链接 URL', 'warning');
        return;
      }
      if (!isValidHttpUrl(editorForm.url)) {
        showNotification?.('URL 必须以 http:// 或 https:// 开头', 'warning');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        title: editorForm.title.trim(),
        content: editorForm.resource_type === 'link' ? '' : editorForm.content,
        category: editorForm.category.trim(),
        tags: editorForm.tags,
        is_public: !!editorForm.is_public,
        resource_type: editorForm.resource_type,
        url: editorForm.resource_type === 'link' ? editorForm.url.trim() : '',
        description: editorForm.description || '',
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

  const prettyHost = (u) => {
    try { return new URL(u).host; } catch { return u; }
  };

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
                ? '仅显示老师公开的资料（含在线文档与外部链接）'
                : '老师可在线编辑 Markdown 文档或添加外部 URL 链接，支持公开/私密切换'}
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
            style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 13 }}
          >
            <option value="all">全部分类</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 13 }}
        >
          <option value="all">全部类型</option>
          <option value="markdown">在线文档</option>
          <option value="link">外部链接</option>
        </select>

        {canEdit && (
          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 13 }}
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
              {searchQuery || filterCategory !== 'all' || filterType !== 'all'
                ? '没有匹配的资料'
                : (canEdit ? '还没有资料，点击右上"新建资料"开始' : '老师还未公开任何资料')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(item => {
                const active = item.id === selectedId;
                const isLink = item.resource_type === 'link';
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
                    <div className="flex items-start gap-2">
                      <div style={{
                        marginTop: 2,
                        color: isLink ? '#0ea5e9' : tokens.colors.accent.primary,
                      }}>
                        {isLink ? <LinkIcon size={14} /> : <FileEdit size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ fontSize: 14 }}>{item.title}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap" style={{ fontSize: 11, color: tokens.colors.text.muted }}>
                          {item.category && <Badge>{item.category}</Badge>}
                          {isLink && <Badge color={isDark ? 'rgba(14,165,233,0.18)' : 'rgba(14,165,233,0.12)'}><LinkIcon size={10} /> 链接</Badge>}
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
                    {selected.resource_type === 'link'
                      ? <Badge color={isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.12)'}><LinkIcon size={10} /> 外部链接</Badge>
                      : <Badge color={isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)'}><FileEdit size={10} /> 在线文档</Badge>}
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

              {/* 正文：根据类型渲染 */}
              {selected.resource_type === 'link' ? (
                <div className="space-y-3">
                  {selected.description && (
                    <p style={{ color: tokens.colors.text.secondary, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {selected.description}
                    </p>
                  )}
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl transition-all hover:opacity-90"
                    style={{
                      background: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.06)',
                      border: `1px solid ${isDark ? 'rgba(14,165,233,0.4)' : 'rgba(14,165,233,0.3)'}`,
                      textDecoration: 'none',
                      color: tokens.colors.text.primary,
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDark ? 'rgba(14,165,233,0.25)' : 'rgba(14,165,233,0.15)',
                      flexShrink: 0,
                    }}>
                      <LinkIcon size={20} style={{ color: '#0ea5e9' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" style={{ fontSize: 14 }}>
                        {prettyHost(selected.url)}
                      </div>
                      <div className="truncate" style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                        {selected.url}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{ background: '#0ea5e9', color: '#fff', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                      <ExternalLink size={13} /> 打开
                    </div>
                  </a>
                </div>
              ) : (
                <MarkdownPreview content={selected.content} emptyHint="该资料还没有正文内容" />
              )}
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

            {/* 资料类型切换 */}
            <div className="px-5 pt-4">
              <div className="inline-flex rounded-lg p-1" style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${tokens.colors.border.subtle}`,
              }}>
                {[
                  { k: 'markdown', label: '在线文档（Markdown）', icon: FileEdit },
                  { k: 'link', label: '外部链接（URL）', icon: LinkIcon },
                ].map(({ k, label, icon: Icon }) => {
                  const active = editorForm.resource_type === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setEditorForm(f => ({ ...f, resource_type: k }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
                      style={{
                        background: active
                          ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)')
                          : 'transparent',
                        color: active ? tokens.colors.accent.primary : tokens.colors.text.secondary,
                        fontSize: 13, fontWeight: active ? 600 : 400,
                      }}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 表单字段 */}
            <div className="p-5 pt-3 space-y-3 overflow-y-auto" style={{ flex: 1 }}>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>标题 *</label>
                <input
                  value={editorForm.title}
                  onChange={(e) => setEditorForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={editorForm.resource_type === 'link' ? '例如：EJU 物理官方样题（链接）' : '例如：EJU 物理复习要点（2026）'}
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

              {editorForm.resource_type === 'link' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>资料链接（URL） *</label>
                    <input
                      value={editorForm.url}
                      onChange={(e) => setEditorForm(f => ({ ...f, url: e.target.value }))}
                      placeholder="https://example.com/resource"
                      style={inputStyle}
                    />
                    {editorForm.url && !isValidHttpUrl(editorForm.url) && (
                      <div style={{ fontSize: 12, color: tokens.colors.accent.danger, marginTop: 4 }}>
                        URL 必须以 http:// 或 https:// 开头
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>简要说明（可选）</label>
                    <textarea
                      value={editorForm.description}
                      onChange={(e) => setEditorForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="对这个链接资料的简短介绍，例如：EJU 官方公开的样题 PDF，建议先做一遍再对答案。"
                      style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                  {/* 链接预览 */}
                  {isValidHttpUrl(editorForm.url) && (
                    <div className="p-3 rounded-lg flex items-center gap-3"
                      style={{
                        background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.05)',
                        border: `1px solid ${isDark ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.2)'}`,
                      }}>
                      <LinkIcon size={18} style={{ color: '#0ea5e9' }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ fontSize: 13 }}>{prettyHost(editorForm.url)}</div>
                        <div className="truncate" style={{ fontSize: 11, color: tokens.colors.text.muted }}>{editorForm.url}</div>
                      </div>
                      <a href={editorForm.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                        style={{ color: '#0ea5e9', border: `1px solid rgba(14,165,233,0.3)` }}>
                        <ExternalLink size={11} /> 预览
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium" style={{ color: tokens.colors.text.secondary }}>
                      正文内容（Markdown，支持表格 / 任务列表 / 代码块 等）
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
                      placeholder={`支持 Markdown：\n# 一级标题\n## 二级标题\n**粗体**  *斜体*  ~~删除线~~  \`行内代码\`\n\n- 列表项\n  - 嵌套\n- [x] 已完成任务\n- [ ] 待办事项\n\n1. 有序列表\n2. 第二项\n\n> 引用\n\n| 列1 | 列2 | 列3 |\n| --- | :---: | ---: |\n| A | B | C |\n\n\`\`\`js\nconsole.log('代码块')\n\`\`\`\n\n[链接](https://example.com)  ![图片](https://example.com/x.png)`}
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
              )}
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
