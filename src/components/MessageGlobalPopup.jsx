// 【新需求79-B】全局新消息弹窗
// 设计：
//   - 在 App 顶层挂载（任何登录后页面都生效），不依赖时间线/消息中心 tab
//   - 启动后立即拉一次 banner，并每 60s 轮询一次未读
//   - 发现新的 message id（不在本会话 seenIds 内）→ 加入弹窗队列
//   - 当前展示队列首条；用户两种选择：
//       「关闭弹窗」：仅本会话隐藏，不调 markRead，下次刷新还会再弹
//       「标记已读」：调 messagesAPI.markRead，从队列移除并永久不再弹
//   - 多条新消息按时间倒序依次弹（关闭一条立即弹下一条）
//   - 启动时把首次拉到的「初始未读」全部加入 seenIds，避免老消息把用户淹没
//     —— 仅"启动之后新发布的消息"才会触发弹窗
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCheck, X } from 'lucide-react'
import { messagesAPI } from '../services/api'
import { useTheme } from '../context/ThemeContext'
import MessageDetailModal, { renderMarkdown } from './MessageDetailModal'

const POLL_INTERVAL_MS = 60 * 1000 // 60s 轮询一次

// 是否已通过 sessionStorage 看过启动初值（避免在登录后立即被一堆历史未读弹屏）
const SEEN_KEY = 'msg_global_popup_seen_ids_v1'
const loadSeen = () => {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch { return new Set() }
}
const saveSeen = (set) => {
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set))) } catch {}
}

const MessageGlobalPopup = ({ enabled = true }) => {
  const { tokens } = useTheme()
  // 弹窗队列（待展示的新消息）
  const [queue, setQueue] = useState([])
  // 当前正在展示的那一条
  const [active, setActive] = useState(null)
  // 这个会话内已经"见过"（弹过 / 主动关闭 / 标记已读）的 id，下次轮询不再触发弹窗
  const seenRef = useRef(loadSeen())
  // 防止"启动后第一次拉到的全部未读"统统被当作"新消息"弹给用户
  const initializedRef = useRef(false)

  const persistSeen = useCallback(() => {
    saveSeen(seenRef.current)
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await messagesAPI.banner()
      // apiRequest 已剥 data 外壳；后端 banner 返回 data 是数组（res 直接是数组）
      const list = Array.isArray(res) ? res : (res?.data ?? [])
      if (!Array.isArray(list)) return

      if (!initializedRef.current) {
        // 首轮：把当前所有未读都视为"老的"，直接静默加入 seenIds，不弹窗
        list.forEach(m => seenRef.current.add(m.id))
        persistSeen()
        initializedRef.current = true
        return
      }

      // 后续轮询：找出真正"新"的消息（id 没在 seenIds 里）
      const fresh = list.filter(m => !seenRef.current.has(m.id))
      if (fresh.length === 0) return
      // 标记 seen（避免下次轮询重复入队）
      fresh.forEach(m => seenRef.current.add(m.id))
      persistSeen()
      // 入队（按时间倒序入队，新消息优先弹）
      setQueue(prev => [...prev, ...fresh])
    } catch (e) {
      // 静默：消息接口故障不影响主流程
      console.warn('[MessageGlobalPopup] poll 失败:', e)
    }
  }, [persistSeen])

  useEffect(() => {
    if (!enabled) return
    poll()
    const t = setInterval(poll, POLL_INTERVAL_MS)
    // 监听同窗口手动刷新事件（例如其它组件发消息后想立即触发一次轮询）
    const onTrigger = () => poll()
    window.addEventListener('msg:refresh-popup', onTrigger)
    return () => {
      clearInterval(t)
      window.removeEventListener('msg:refresh-popup', onTrigger)
    }
  }, [enabled, poll])

  // 当 queue 有内容、且当前没有 active 时，自动取队首展示
  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0])
      setQueue(prev => prev.slice(1))
    }
  }, [active, queue])

  // 关闭弹窗（不标记已读）
  const handleDismiss = () => {
    setActive(null)
  }
  // 标记已读
  const handleMarkRead = async () => {
    const cur = active
    setActive(null)
    if (cur?.id != null) {
      try { await messagesAPI.markRead(cur.id) } catch { /* 忽略 */ }
    }
  }

  if (!active) return null
  return (
    <CustomMessageModal
      message={active}
      tokens={tokens}
      onDismiss={handleDismiss}
      onMarkRead={handleMarkRead}
    />
  )
}

// ─── 带"关闭弹窗" + "标记已读" 双按钮的全局消息弹窗 ──────────────────────────
const CustomMessageModal = ({ message, tokens, onDismiss, onMarkRead }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  if (!message) return null
  const html = message.content_type === 'html'
    ? message.content
    : renderMarkdown(message.content || '')
  const audienceLabel = ({ student: '学生', teacher: '老师', all: '全员' }[message.audience] || message.audience || '全员')

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          background: tokens.colors.bg.surface, color: tokens.colors.text.primary,
          borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
          border: `1px solid ${tokens.colors.border.default}`,
          overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div style={{
          padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12,
          borderBottom: `1px solid ${tokens.colors.border.default}`,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.12), rgba(16,185,129,0.10))',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: '#fee2e2', color: '#b91c1c', fontWeight: 700,
              }}>新消息</span>
              {message.pinned && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  background: '#fde68a', color: '#92400e', fontWeight: 700,
                }}>📌 置顶</span>
              )}
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(99,102,241,0.16)', color: '#4f46e5', fontWeight: 600,
              }}>{audienceLabel}</span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '8px 0 4px 0', wordBreak: 'break-word' }}>
              {message.title}
            </h3>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>
              {message.author_name || '匿名'} · {message.created_at}
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="关闭弹窗"
            title="关闭弹窗（下次再看）"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: tokens.colors.text.muted, padding: 6, borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 正文（可滚动） */}
        <div
          style={{
            padding: '16px 18px', fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word',
            overflow: 'auto', flex: 1,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* 底部双按钮 */}
        <div style={{
          padding: '10px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end',
          borderTop: `1px solid ${tokens.colors.border.default}`,
          background: tokens.colors.bg.surface,
        }}>
          <button
            type="button" onClick={onDismiss}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13,
              border: `1px solid ${tokens.colors.border.default}`,
              background: 'transparent', color: tokens.colors.text.secondary,
              cursor: 'pointer',
            }}
            title="关闭弹窗，但保留为未读，下次刷新还会再弹"
          >
            关闭弹窗
          </button>
          <button
            type="button" onClick={onMarkRead}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 6px 14px rgba(99,102,241,0.25)',
            }}
            title="将这条消息标记为已读"
          >
            <CheckCheck size={14} /> 标记为已读
          </button>
        </div>
      </div>
    </div>
  )
}

export default MessageGlobalPopup
