// 【新需求77】时间线顶部消息横幅
// 设计：
//   - 拉取 /api/messages/banner（最新未读 + 限制 5 条）
//   - 横幅以折叠卡片形式展示，点击行可展开查看详情；点击 ✕ 标记单条已读
//   - 「全部已读」按钮：一键清空横幅
//   - 数据源在父组件挂载、tab 切换时刷新
import React, { useEffect, useState, useCallback } from 'react'
import { Bell, X, ChevronRight, CheckCheck } from 'lucide-react'
import { messagesAPI } from '../services/api'
import { useTheme } from '../theme'
import MessageDetailModal from './MessageDetailModal'

const audienceColor = (a) => {
  switch (a) {
    case 'student': return { bg: 'rgba(16,185,129,0.16)', fg: '#047857' }
    case 'teacher': return { bg: 'rgba(59,130,246,0.16)', fg: '#1d4ed8' }
    default: return { bg: 'rgba(99,102,241,0.16)', fg: '#4f46e5' }
  }
}
const audienceLabel = (a) => ({ student: '学生', teacher: '老师', all: '全员' }[a] || '全员')

const MessageBanner = () => {
  const { tokens } = useTheme()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(null) // 选中查看详情

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await messagesAPI.banner()
      const data = (res && (res.data ?? res)) || []
      setList(Array.isArray(data) ? data : [])
    } catch (e) {
      // 静默失败：消息系统挂掉不影响时间线主流程
      console.warn('加载消息横幅失败:', e)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // 每 2 分钟自动刷新一次
    const t = setInterval(load, 2 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  const handleDismiss = async (id, e) => {
    e?.stopPropagation()
    setList(prev => prev.filter(x => x.id !== id)) // 乐观更新
    try { await messagesAPI.markRead(id) } catch { /* 忽略 */ }
  }

  const handleAllRead = async () => {
    setList([])
    try { await messagesAPI.markAllRead() } catch { /* 忽略 */ }
  }

  const handleOpen = async (item) => {
    setActive(item)
    // 点开后即视为已读
    try { await messagesAPI.markRead(item.id) } catch { /* 忽略 */ }
    setList(prev => prev.filter(x => x.id !== item.id))
  }

  if (loading && list.length === 0) return null
  if (list.length === 0) return null

  return (
    <>
      <div style={{
        marginBottom: 16, borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${tokens.colors.border.default}`,
        background: tokens.colors.bg.surface,
      }}>
        {/* 头部 */}
        <div style={{
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.10), rgba(16,185,129,0.10))',
          borderBottom: `1px solid ${tokens.colors.border.default}`,
        }}>
          <Bell size={16} style={{ color: '#6366f1' }} />
          <strong style={{ fontSize: 13 }}>站内消息</strong>
          <span style={{
            fontSize: 11, padding: '1px 8px', borderRadius: 999,
            background: 'rgba(239,68,68,0.18)', color: '#b91c1c', fontWeight: 700,
          }}>{list.length} 条未读</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleAllRead}
            style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 8,
              border: `1px solid ${tokens.colors.border.default}`,
              background: 'transparent', color: tokens.colors.text.secondary,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
            title="一键全部标记为已读"
          >
            <CheckCheck size={13} /> 全部已读
          </button>
        </div>
        {/* 列表 */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map((m) => {
            const ac = audienceColor(m.audience)
            return (
              <li
                key={m.id}
                onClick={() => handleOpen(m)}
                style={{
                  padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                  borderTop: `1px dashed ${tokens.colors.border.subtle || tokens.colors.border.default}`,
                }}
              >
                {m.pinned && (
                  <span style={{ fontSize: 12 }}>📌</span>
                )}
                <span style={{
                  fontSize: 11, padding: '1px 8px', borderRadius: 999,
                  background: ac.bg, color: ac.fg, fontWeight: 600, flexShrink: 0,
                }}>{audienceLabel(m.audience)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: tokens.colors.text.primary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{m.title}</div>
                  <div style={{
                    fontSize: 11, color: tokens.colors.text.muted, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.author_name || '匿名'} · {m.created_at}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: tokens.colors.text.muted, flexShrink: 0 }} />
                <button
                  onClick={(e) => handleDismiss(m.id, e)}
                  aria-label="标记已读"
                  title="标记已读"
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: tokens.colors.text.muted, padding: 4, borderRadius: 6, flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {active && (
        <MessageDetailModal message={active} onClose={() => setActive(null)} />
      )}
    </>
  )
}

export default MessageBanner
