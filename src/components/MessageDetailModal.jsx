// 【新需求77】消息详情弹窗 + 简易 Markdown 渲染
// 设计：
//   - 不引入第三方 marked/react-markdown，自己实现一个轻量 Markdown 子集渲染器
//     (#/##/### 标题、**粗体**、*斜体*、~~删除线~~、`内联代码`、链接、图片、列表、引用、---、代码块)
//   - 全部 HTML 输出经 escapeHtml 转义后再插入有限的标签，避免 XSS
import React, { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { useTheme } from '../theme'

// ─── 极简 Markdown → HTML（白名单输出）─────────────────────────────────────────
const escapeHtml = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

// 行内格式化（输入已被 escapeHtml）
const inline = (s) => {
  let out = s
  // 图片 ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, alt, url, title) => `<img src="${url}" alt="${alt}" title="${title || ''}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`)
  // 链接 [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, text, url) => `<a href="${url}" target="_blank" rel="noreferrer noopener" style="color:#2563eb;text-decoration:underline;">${text}</a>`)
  // 粗体 **x**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // 斜体 *x*
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  // 删除线 ~~x~~
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  // 内联代码 `x`
  out = out.replace(/`([^`]+)`/g,
    '<code style="background:rgba(127,127,127,0.18);padding:2px 6px;border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.9em;">$1</code>')
  return out
}

export const renderMarkdown = (md = '') => {
  if (!md) return ''
  const lines = String(md).split(/\r?\n/)
  const html = []
  let i = 0
  let inUl = false
  let inOl = false
  let inBq = false
  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false }
    if (inOl) { html.push('</ol>'); inOl = false }
    if (inBq) { html.push('</blockquote>'); inBq = false }
  }
  while (i < lines.length) {
    const raw = lines[i]
    const escaped = escapeHtml(raw)
    // 代码块
    if (/^```/.test(raw)) {
      closeLists()
      const codeLines = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(escapeHtml(lines[i]))
        i++
      }
      i++ // skip closing ```
      html.push(`<pre style="background:rgba(127,127,127,0.12);padding:12px;border-radius:8px;overflow-x:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.88em;line-height:1.5;"><code>${codeLines.join('\n')}</code></pre>`)
      continue
    }
    // 标题
    const h = raw.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      closeLists()
      const lv = h[1].length
      const sizeMap = { 1: '1.6em', 2: '1.35em', 3: '1.18em', 4: '1.05em', 5: '1em', 6: '0.95em' }
      html.push(`<h${lv} style="font-weight:700;margin:14px 0 6px 0;font-size:${sizeMap[lv]};">${inline(escapeHtml(h[2]))}</h${lv}>`)
      i++; continue
    }
    // 分隔线
    if (/^\s*-{3,}\s*$/.test(raw)) {
      closeLists()
      html.push('<hr style="border:none;border-top:1px solid rgba(127,127,127,0.3);margin:14px 0;" />')
      i++; continue
    }
    // 引用
    if (/^>\s?/.test(raw)) {
      if (inUl || inOl) closeLists()
      if (!inBq) { html.push('<blockquote style="border-left:3px solid #94a3b8;padding:4px 12px;margin:8px 0;color:rgba(127,127,127,0.95);">'); inBq = true }
      html.push(`<div>${inline(escapeHtml(raw.replace(/^>\s?/, '')))}</div>`)
      i++; continue
    } else if (inBq) {
      closeLists()
    }
    // 无序列表
    if (/^\s*[-*+]\s+/.test(raw)) {
      if (inOl) { html.push('</ol>'); inOl = false }
      if (!inUl) { html.push('<ul style="padding-left:20px;margin:6px 0;">'); inUl = true }
      html.push(`<li style="margin:2px 0;">${inline(escaped.replace(/^\s*[-*+]\s+/, ''))}</li>`)
      i++; continue
    }
    // 有序列表
    if (/^\s*\d+\.\s+/.test(raw)) {
      if (inUl) { html.push('</ul>'); inUl = false }
      if (!inOl) { html.push('<ol style="padding-left:22px;margin:6px 0;">'); inOl = true }
      html.push(`<li style="margin:2px 0;">${inline(escaped.replace(/^\s*\d+\.\s+/, ''))}</li>`)
      i++; continue
    }
    // 空行
    if (/^\s*$/.test(raw)) {
      closeLists()
      html.push('<div style="height:6px;"></div>')
      i++; continue
    }
    // 普通段落
    closeLists()
    html.push(`<p style="margin:6px 0;line-height:1.7;">${inline(escaped)}</p>`)
    i++
  }
  closeLists()
  return html.join('')
}

// ─── 详情弹窗组件 ──────────────────────────────────────────────────────────────
const audienceLabel = (a) => ({ student: '学生', teacher: '老师', all: '全员' }[a] || a || '全员')

const MessageDetailModal = ({ message, onClose }) => {
  const { tokens } = useTheme()
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!message) return null

  const html = message.content_type === 'html'
    ? message.content // 后端已限定，仅信任管理员发布的 html；前端不再二次净化
    : renderMarkdown(message.content || '')

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '85vh', overflow: 'auto',
          background: tokens.colors.bg.surface, color: tokens.colors.text.primary,
          borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
        }}
      >
        {/* 头部 */}
        <div style={{
          padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12,
          borderBottom: `1px solid ${tokens.colors.border.default}`,
          position: 'sticky', top: 0, background: tokens.colors.bg.surface, zIndex: 1,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {message.pinned && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  background: '#fde68a', color: '#92400e', fontWeight: 700,
                }}>📌 置顶</span>
              )}
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(99,102,241,0.16)', color: '#4f46e5', fontWeight: 600,
              }}>{audienceLabel(message.audience)}</span>
              {message.revoked && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  background: 'rgba(239,68,68,0.18)', color: '#b91c1c', fontWeight: 700,
                }}>已撤回</span>
              )}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 4px 0', wordBreak: 'break-word' }}>
              {message.title}
            </h3>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>
              {message.author_name || '匿名'} · {message.created_at}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: tokens.colors.text.muted, padding: 6, borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 正文 */}
        <div
          style={{ padding: '16px 20px', fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* 附件图片（image_urls 中未在正文里显式出现的图片，统一在底部展示） */}
        {Array.isArray(message.image_urls) && message.image_urls.length > 0 && (
          <div style={{ padding: '0 20px 16px 20px' }}>
            {message.image_urls.filter(u => !String(message.content || '').includes(u)).map((u, idx) => (
              <a key={idx} href={u} target="_blank" rel="noreferrer noopener"
                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2563eb', marginRight: 12 }}>
                <ExternalLink size={12} /> 附件 {idx + 1}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageDetailModal
