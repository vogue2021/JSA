// 【新需求77】消息中心页面
// 三大功能区域（顶部 Tab 切换）：
//   1) 发布消息：标题 + 受众 + 置顶 + Markdown 编辑 + 实时预览 + R2 图片插入
//   2) 我发布的：仅 admin / publish_messages 老师可见，可搜索/编辑/撤回/删除
//   3) 历史消息：所有用户可见自己有权查看的消息，分页 + 搜索 + 一键全部已读
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Send, Image as ImageIcon, FileText, History, Megaphone, Pin, PinOff,
  Edit2, Trash2, RotateCcw, Search, CheckCheck, Loader2, Eye,
  Bold, Italic, List, ListOrdered, Quote, Code as CodeIcon, Link as LinkIcon, Heading,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'
import { messagesAPI, uploadAPI } from '../services/api'
import MessageDetailModal, { renderMarkdown } from './MessageDetailModal'

const AUDIENCE_OPTIONS = [
  { value: 'all', label: '全员（学生 + 老师）' },
  { value: 'student', label: '仅学生' },
  { value: 'teacher', label: '仅老师' },
]

const audienceLabel = (a) => ({ student: '学生', teacher: '老师', all: '全员' }[a] || a || '全员')

// ─── 富文本编辑器（Markdown + 工具栏 + 预览）────────────────────────────────
const MarkdownEditor = ({ value, onChange, onInsertImage, uploading, tokens }) => {
  const taRef = useRef(null)

  // 在光标位置插入文本
  const insertAtCursor = useCallback((before, after = '', placeholder = '') => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.substring(start, end) || placeholder
    const next = value.substring(0, start) + before + selected + after + value.substring(end)
    onChange(next)
    // 还原焦点和选区
    requestAnimationFrame(() => {
      ta.focus()
      const cursorStart = start + before.length
      ta.setSelectionRange(cursorStart, cursorStart + selected.length)
    })
  }, [value, onChange])

  const handlePickFile = (e) => {
    const f = e.target.files?.[0]
    if (f) onInsertImage?.(f, insertAtCursor)
    e.target.value = '' // 允许同一文件再次选
  }

  const btnStyle = {
    border: `1px solid ${tokens.colors.border.default}`,
    background: 'transparent', color: tokens.colors.text.secondary,
    padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
  }

  return (
    <div style={{
      border: `1px solid ${tokens.colors.border.default}`, borderRadius: 10,
      background: tokens.colors.bg.surface,
    }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8,
        borderBottom: `1px solid ${tokens.colors.border.default}`,
      }}>
        <button type="button" style={btnStyle} title="一级标题"
                onClick={() => insertAtCursor('# ', '', '标题')}><Heading size={14} /> H1</button>
        <button type="button" style={btnStyle} title="二级标题"
                onClick={() => insertAtCursor('## ', '', '小标题')}>H2</button>
        <button type="button" style={btnStyle} title="粗体"
                onClick={() => insertAtCursor('**', '**', '粗体')}><Bold size={14} /></button>
        <button type="button" style={btnStyle} title="斜体"
                onClick={() => insertAtCursor('*', '*', '斜体')}><Italic size={14} /></button>
        <button type="button" style={btnStyle} title="无序列表"
                onClick={() => insertAtCursor('- ', '', '列表项')}><List size={14} /></button>
        <button type="button" style={btnStyle} title="有序列表"
                onClick={() => insertAtCursor('1. ', '', '列表项')}><ListOrdered size={14} /></button>
        <button type="button" style={btnStyle} title="引用"
                onClick={() => insertAtCursor('> ', '', '引用文字')}><Quote size={14} /></button>
        <button type="button" style={btnStyle} title="代码"
                onClick={() => insertAtCursor('`', '`', 'code')}><CodeIcon size={14} /></button>
        <button type="button" style={btnStyle} title="链接"
                onClick={() => insertAtCursor('[', '](https://)', '链接文字')}><LinkIcon size={14} /></button>
        <label style={{ ...btnStyle, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }} title="插入图片（来自 R2）">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} 图片
          <input type="file" accept="image/*" hidden onChange={handlePickFile} disabled={uploading} />
        </label>
      </div>
      {/* 文本域 */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="支持 Markdown：**粗体**、*斜体*、# 标题、- 列表、`代码`、![](图片)…"
        rows={12}
        style={{
          width: '100%', minHeight: 220, resize: 'vertical',
          padding: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          fontSize: 13, lineHeight: 1.65, border: 'none', outline: 'none',
          background: 'transparent', color: tokens.colors.text.primary,
          borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── 主组件 ────────────────────────────────────────────────────────────────────
const MessagesPage = () => {
  const { user, hasPermission, showNotification } = useApp()
  const { tokens } = useTheme()

  const canPublish = user?.role === 'admin' || hasPermission?.('publish_messages')

  // tab：'compose' | 'mine' | 'history'
  // 不能发布的用户默认只看 history
  const [tab, setTab] = useState(canPublish ? 'compose' : 'history')

  // ─── 发布表单 ───────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState(null) // 非 null 表示在编辑某条
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState('all')
  const [pinned, setPinned] = useState(false)
  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const resetForm = () => {
    setEditingId(null); setTitle(''); setAudience('all'); setPinned(false)
    setContent(''); setImageUrls([]); setShowPreview(false)
  }

  const handleInsertImage = async (file, insertAtCursor) => {
    try {
      setUploading(true)
      const res = await uploadAPI.uploadImage(file)
      const url = res?.url
      if (!url) throw new Error('上传响应缺少 url')
      // 在编辑器里插入 markdown 图片语法
      insertAtCursor(`![image](${url})\n`, '', '')
      setImageUrls(prev => [...prev, url])
      showNotification?.('图片已上传')
    } catch (e) {
      showNotification?.(e.message || '图片上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim()) { showNotification?.('请填写标题'); return }
    if (!content.trim()) { showNotification?.('请填写正文'); return }
    try {
      setSubmitting(true)
      const payload = {
        title: title.trim(), content, content_type: 'markdown',
        audience, pinned, image_urls: imageUrls,
      }
      if (editingId) {
        await messagesAPI.update(editingId, payload)
        showNotification?.('消息已更新')
      } else {
        await messagesAPI.create(payload)
        showNotification?.('消息已发布')
      }
      resetForm()
      // 刷新列表
      await Promise.all([loadMine(), loadHistory()])
      setTab('mine')
    } catch (e) {
      showNotification?.(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── 我发布的 ───────────────────────────────────────────────────────────
  const [mineList, setMineList] = useState([])
  const [mineLoading, setMineLoading] = useState(false)
  const loadMine = useCallback(async () => {
    if (!canPublish) return
    try {
      setMineLoading(true)
      const res = await messagesAPI.list({ mine: true, pageSize: 50, includeRevoked: true })
      setMineList(res?.data?.list || [])
    } catch (e) {
      console.warn('加载我发布的消息失败:', e)
    } finally {
      setMineLoading(false)
    }
  }, [canPublish])

  const startEdit = (m) => {
    setEditingId(m.id)
    setTitle(m.title || '')
    setAudience(m.audience || 'all')
    setPinned(!!m.pinned)
    setContent(m.content || '')
    setImageUrls(Array.isArray(m.image_urls) ? m.image_urls : [])
    setTab('compose')
  }
  const handleRevoke = async (m) => {
    if (!confirm(`撤回消息「${m.title}」？撤回后用户端将不再展示。`)) return
    try {
      await messagesAPI.revoke(m.id, true)
      showNotification?.('消息已撤回')
      await Promise.all([loadMine(), loadHistory()])
    } catch (e) { showNotification?.(e.message || '撤回失败') }
  }
  const handleUnrevoke = async (m) => {
    try {
      await messagesAPI.revoke(m.id, false)
      showNotification?.('消息已恢复')
      await Promise.all([loadMine(), loadHistory()])
    } catch (e) { showNotification?.(e.message || '恢复失败') }
  }
  const handleDelete = async (m) => {
    if (user?.role !== 'admin') {
      showNotification?.('仅管理员可永久删除，老师请使用撤回')
      return
    }
    if (!confirm(`永久删除消息「${m.title}」？此操作不可恢复。`)) return
    try {
      await messagesAPI.remove(m.id)
      showNotification?.('已删除')
      await Promise.all([loadMine(), loadHistory()])
    } catch (e) { showNotification?.(e.message || '删除失败') }
  }

  // ─── 历史消息 ───────────────────────────────────────────────────────────
  const [hist, setHist] = useState({ list: [], total: 0, page: 1, pageSize: 10 })
  const [histSearch, setHistSearch] = useState('')
  const [histLoading, setHistLoading] = useState(false)
  const [active, setActive] = useState(null)
  const loadHistory = useCallback(async (page = 1, search = histSearch) => {
    try {
      setHistLoading(true)
      const res = await messagesAPI.list({ page, pageSize: 10, search })
      setHist({
        list: res?.data?.list || [],
        total: res?.data?.total || 0,
        page: res?.data?.page || 1,
        pageSize: res?.data?.pageSize || 10,
      })
    } catch (e) {
      console.warn('加载历史消息失败:', e)
    } finally {
      setHistLoading(false)
    }
  }, [histSearch])

  const handleOpenDetail = async (m) => {
    try {
      const res = await messagesAPI.get(m.id)
      setActive(res?.data || m)
      // 详情打开后历史里这一条会被服务端标记已读，这里不再重新拉列表，
      // 因为本页是按时间排序，不展示已读/未读样式（横幅才展示）。
    } catch (e) {
      setActive(m)
    }
  }
  const handleAllRead = async () => {
    try {
      await messagesAPI.markAllRead()
      showNotification?.('已全部标记为已读')
    } catch (e) { showNotification?.(e.message || '操作失败') }
  }

  useEffect(() => { loadMine() }, [loadMine])
  useEffect(() => { loadHistory(1) }, [loadHistory])

  // ─── 渲染 ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(hist.total / hist.pageSize))

  return (
    <div style={{
      maxWidth: 1100, margin: '0 auto', padding: '8px 4px',
      color: tokens.colors.text.primary,
    }}>
      {/* 页面标题 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap',
      }}>
        <Megaphone size={22} style={{ color: '#6366f1' }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>消息中心</h2>
        <span style={{ color: tokens.colors.text.muted, fontSize: 13 }}>
          站内通知 · 公告 · 重要事项发布
        </span>
      </div>

      {/* Tab 切换 */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap',
        borderBottom: `1px solid ${tokens.colors.border.default}`,
      }}>
        {canPublish && (
          <TabBtn active={tab === 'compose'} onClick={() => setTab('compose')} icon={<Send size={14} />} tokens={tokens}>
            {editingId ? '编辑中…' : '发布消息'}
          </TabBtn>
        )}
        {canPublish && (
          <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')} icon={<FileText size={14} />} tokens={tokens}>
            我发布的
          </TabBtn>
        )}
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<History size={14} />} tokens={tokens}>
          历史消息
        </TabBtn>
      </div>

      {/* ─── 发布消息 ─── */}
      {tab === 'compose' && canPublish && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* 顶部表单字段 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 130px', gap: 10 }}>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="消息标题（必填）"
              style={{
                padding: '10px 12px', border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: 10, background: tokens.colors.bg.surface,
                color: tokens.colors.text.primary, fontSize: 14, outline: 'none',
              }}
            />
            <select
              value={audience} onChange={(e) => setAudience(e.target.value)}
              style={{
                padding: '10px 12px', border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: 10, background: tokens.colors.bg.surface,
                color: tokens.colors.text.primary, fontSize: 14, outline: 'none',
              }}
            >
              {AUDIENCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button" onClick={() => setPinned(p => !p)}
              style={{
                padding: '10px 12px', border: `1px solid ${pinned ? '#fbbf24' : tokens.colors.border.default}`,
                background: pinned ? 'rgba(251,191,36,0.18)' : tokens.colors.bg.surface,
                color: pinned ? '#92400e' : tokens.colors.text.secondary,
                borderRadius: 10, fontSize: 13, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {pinned ? <Pin size={14} /> : <PinOff size={14} />} {pinned ? '已置顶' : '置顶'}
            </button>
          </div>

          {/* 编辑器 + 预览 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr',
            gap: 12,
          }}>
            <MarkdownEditor
              value={content} onChange={setContent}
              onInsertImage={handleInsertImage} uploading={uploading} tokens={tokens}
            />
            {showPreview && (
              <div style={{
                border: `1px solid ${tokens.colors.border.default}`, borderRadius: 10,
                background: tokens.colors.bg.surface, padding: 16, minHeight: 220, overflow: 'auto',
                fontSize: 14, lineHeight: 1.7,
              }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content || '*（暂无内容）*') }}
              />
            )}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button" onClick={() => setShowPreview(p => !p)}
              style={{
                padding: '10px 16px', borderRadius: 10, fontSize: 13,
                border: `1px solid ${tokens.colors.border.default}`,
                background: tokens.colors.bg.surface, color: tokens.colors.text.secondary,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Eye size={14} /> {showPreview ? '关闭预览' : '实时预览'}
            </button>
            <div style={{ flex: 1 }} />
            {editingId && (
              <button
                type="button" onClick={resetForm}
                style={{
                  padding: '10px 16px', borderRadius: 10, fontSize: 13,
                  border: `1px solid ${tokens.colors.border.default}`,
                  background: 'transparent', color: tokens.colors.text.secondary, cursor: 'pointer',
                }}
              >取消编辑</button>
            )}
            <button
              type="button" onClick={handleSubmit} disabled={submitting}
              style={{
                padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                border: 'none', cursor: submitting ? 'wait' : 'pointer',
                background: submitting ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: '0 6px 14px rgba(99,102,241,0.25)',
              }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <Send size={14} />
              {editingId ? '保存修改' : '发布消息'}
            </button>
          </div>
        </div>
      )}

      {/* ─── 我发布的 ─── */}
      {tab === 'mine' && canPublish && (
        <div>
          {mineLoading && <div style={{ color: tokens.colors.text.muted, fontSize: 13 }}>加载中…</div>}
          {!mineLoading && mineList.length === 0 && (
            <EmptyState text="暂未发布任何消息" tokens={tokens} />
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {mineList.map(m => (
              <MessageCard
                key={m.id} m={m} tokens={tokens}
                onOpen={() => handleOpenDetail(m)}
                actions={
                  <>
                    {!m.revoked && (
                      <ActionBtn onClick={() => startEdit(m)} icon={<Edit2 size={13} />} tokens={tokens}>编辑</ActionBtn>
                    )}
                    {m.revoked
                      ? <ActionBtn onClick={() => handleUnrevoke(m)} icon={<RotateCcw size={13} />} tokens={tokens}>恢复</ActionBtn>
                      : <ActionBtn onClick={() => handleRevoke(m)} icon={<RotateCcw size={13} />} tokens={tokens}>撤回</ActionBtn>}
                    {user?.role === 'admin' && (
                      <ActionBtn onClick={() => handleDelete(m)} icon={<Trash2 size={13} />} tokens={tokens} danger>删除</ActionBtn>
                    )}
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── 历史消息 ─── */}
      {tab === 'history' && (
        <div>
          {/* 搜索栏 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={14} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: tokens.colors.text.muted,
              }} />
              <input
                type="text" placeholder="搜索标题或正文…"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadHistory(1, histSearch) }}
                style={{
                  width: '100%', padding: '9px 12px 9px 32px',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: 10, background: tokens.colors.bg.surface,
                  color: tokens.colors.text.primary, fontSize: 13, outline: 'none',
                }}
              />
            </div>
            <button
              onClick={() => loadHistory(1, histSearch)}
              style={{
                padding: '9px 16px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff', fontSize: 13, cursor: 'pointer',
              }}
            >搜索</button>
            <button
              onClick={handleAllRead}
              style={{
                padding: '9px 14px', borderRadius: 10,
                border: `1px solid ${tokens.colors.border.default}`,
                background: tokens.colors.bg.surface, color: tokens.colors.text.secondary,
                fontSize: 13, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            ><CheckCheck size={14} /> 全部已读</button>
          </div>

          {histLoading && <div style={{ color: tokens.colors.text.muted, fontSize: 13 }}>加载中…</div>}
          {!histLoading && hist.list.length === 0 && (
            <EmptyState text="暂无历史消息" tokens={tokens} />
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {hist.list.map(m => (
              <MessageCard
                key={m.id} m={m} tokens={tokens}
                onOpen={() => handleOpenDetail(m)}
              />
            ))}
          </div>

          {/* 分页 */}
          {hist.total > hist.pageSize && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 14, fontSize: 13, color: tokens.colors.text.secondary,
            }}>
              <button
                disabled={hist.page <= 1}
                onClick={() => loadHistory(hist.page - 1, histSearch)}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${tokens.colors.border.default}`,
                  background: 'transparent', color: 'inherit',
                  cursor: hist.page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: hist.page <= 1 ? 0.5 : 1,
                }}
              >上一页</button>
              <span>第 {hist.page} / {totalPages} 页 · 共 {hist.total} 条</span>
              <button
                disabled={hist.page >= totalPages}
                onClick={() => loadHistory(hist.page + 1, histSearch)}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${tokens.colors.border.default}`,
                  background: 'transparent', color: 'inherit',
                  cursor: hist.page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: hist.page >= totalPages ? 0.5 : 1,
                }}
              >下一页</button>
            </div>
          )}
        </div>
      )}

      {/* 详情弹窗 */}
      {active && <MessageDetailModal message={active} onClose={() => setActive(null)} />}
    </div>
  )
}

// ─── 子组件 ────────────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, icon, children, tokens }) => (
  <button
    type="button" onClick={onClick}
    style={{
      padding: '10px 14px', border: 'none', background: 'transparent',
      color: active ? '#4f46e5' : tokens.colors.text.secondary,
      fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer',
      borderBottom: `2px solid ${active ? '#4f46e5' : 'transparent'}`,
      display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: -1,
    }}
  >{icon}{children}</button>
)

const ActionBtn = ({ onClick, icon, children, tokens, danger }) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 10px', borderRadius: 8, fontSize: 12,
      border: `1px solid ${danger ? 'rgba(239,68,68,0.5)' : tokens.colors.border.default}`,
      background: 'transparent',
      color: danger ? '#dc2626' : tokens.colors.text.secondary,
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
    }}
  >{icon}{children}</button>
)

const MessageCard = ({ m, onOpen, actions, tokens }) => {
  const audColor = m.audience === 'student'
    ? { bg: 'rgba(16,185,129,0.16)', fg: '#047857' }
    : m.audience === 'teacher'
      ? { bg: 'rgba(59,130,246,0.16)', fg: '#1d4ed8' }
      : { bg: 'rgba(99,102,241,0.16)', fg: '#4f46e5' }
  return (
    <div
      onClick={onOpen}
      style={{
        padding: 14, borderRadius: 12, cursor: 'pointer',
        background: tokens.colors.bg.surface,
        border: `1px solid ${tokens.colors.border.default}`,
        opacity: m.revoked ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {m.pinned && <span style={{ fontSize: 12, color: '#92400e' }}>📌 置顶</span>}
        <span style={{
          fontSize: 11, padding: '1px 8px', borderRadius: 999,
          background: audColor.bg, color: audColor.fg, fontWeight: 600,
        }}>{audienceLabel(m.audience)}</span>
        {m.revoked && (
          <span style={{
            fontSize: 11, padding: '1px 8px', borderRadius: 999,
            background: 'rgba(239,68,68,0.18)', color: '#b91c1c', fontWeight: 700,
          }}>已撤回</span>
        )}
        <strong style={{ fontSize: 14, color: tokens.colors.text.primary, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.title}
        </strong>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
        {m.author_name || '匿名'} · {m.created_at}
      </div>
      {m.content && (
        <div style={{
          marginTop: 8, fontSize: 13, color: tokens.colors.text.secondary,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {String(m.content).replace(/[#*`>!\-]+/g, '').slice(0, 200)}
        </div>
      )}
      {actions && (
        <div onClick={(e) => e.stopPropagation()}
             style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  )
}

const EmptyState = ({ text, tokens }) => (
  <div style={{
    padding: 30, textAlign: 'center', color: tokens.colors.text.muted, fontSize: 13,
    border: `1px dashed ${tokens.colors.border.default}`, borderRadius: 12,
  }}>{text}</div>
)

export default MessagesPage
