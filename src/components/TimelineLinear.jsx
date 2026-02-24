import React from 'react';
import { AlertCircle, Check, Edit, Trash2, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const TimelineLinear = ({ events, user, onToggleComplete, onEdit, onDelete }) => {
  const { isDark, tokens, glassEnabled } = useTheme();
  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

  const getMonthGroup = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  };

  const grouped = sortedEvents.reduce((acc, event) => {
    const month = getMonthGroup(event.date);
    if (!acc[month]) acc[month] = [];
    acc[month].push(event);
    return acc;
  }, {});

  const getTypeColor = (type) => {
    const colors = {
      exam: { dot: 'bg-red-500', line: 'border-red-300', bg: 'bg-red-50' },
      deadline: { dot: 'bg-orange-500', line: 'border-orange-300', bg: 'bg-orange-50' },
      contact: { dot: 'bg-blue-500', line: 'border-blue-300', bg: 'bg-blue-50' },
      document: { dot: 'bg-green-500', line: 'border-green-300', bg: 'bg-green-50' },
    };
    return colors[type] || { dot: 'bg-gray-500', line: 'border-gray-300', bg: 'bg-gray-50' };
  };

  const getTypeIcon = (type) => {
    const icons = { exam: '📝', deadline: '⏰', contact: '✉️', document: '📄' };
    return icons[type] || '📌';
  };

  const canEdit = user.role === 'teacher' || user.role === 'admin';

  // 暗色模式事件背景
  const getDarkTypeBg = (type) => {
    const map = {
      exam: 'rgba(239,68,68,0.1)',
      deadline: 'rgba(249,115,22,0.1)',
      contact: 'rgba(59,130,246,0.1)',
      document: 'rgba(34,197,94,0.1)',
    };
    return map[type] || 'rgba(156,163,175,0.1)';
  };

  return (
    <div className="relative">
      {Object.entries(grouped).map(([month, monthEvents], groupIdx) => (
        <div key={month} className="mb-8">
          {/* 月份标题 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-bold shadow">
              <Clock size={16} />
              {month}
            </div>
            <div className="flex-1 h-px" style={{ background: tokens.colors.border.subtle }} />
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{monthEvents.length} 个事项</span>
          </div>

          {/* 时间线 */}
          <div className="relative pl-8">
            {/* 垂直线 */}
            <div className="absolute left-[15px] top-0 bottom-0 w-0.5"
              style={{ background: isDark ? 'linear-gradient(to bottom, rgba(99,102,241,0.3), rgba(139,92,246,0.3), rgba(255,255,255,0.06))' : 'linear-gradient(to bottom, #bfdbfe, #c4b5fd, #e5e7eb)' }} />

            {monthEvents.map((event, idx) => {
              const color = getTypeColor(event.type);
              const isLast = idx === monthEvents.length - 1;

              return (
                <div key={event.id} className={`relative flex gap-4 ${!isLast ? 'pb-6' : 'pb-2'}`}>
                  {/* 时间线节点 */}
                  <div className="absolute left-[-17px] flex flex-col items-center">
                    <div className={`w-4 h-4 rounded-full ${event.completed ? 'bg-green-500' : color.dot} border-2 shadow-sm z-10 flex items-center justify-center`}
                      style={{ borderColor: isDark ? tokens.colors.surface.solid : '#fff' }}>
                      {event.completed && <Check size={10} className="text-white" />}
                    </div>
                  </div>

                  {/* 事件卡片 */}
                  <div className={`flex-1 rounded-lg p-4 transition-all hover:shadow-md ${event.completed ? 'opacity-60' : ''} ${isDark ? '' : color.bg}`}
                    style={{
                      ...(isDark ? { background: getDarkTypeBg(event.type) } : {}),
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : tokens.colors.border.subtle}`,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getTypeIcon(event.type)}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#fff', color: tokens.colors.text.secondary }}>
                            {event.category}
                          </span>
                          {event.urgent && (
                            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#ef4444' }}>
                              <AlertCircle size={12} /> 紧急
                            </span>
                          )}
                          {event.schoolId && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe', color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                              学校关联
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-base" style={{
                          color: event.completed ? tokens.colors.text.muted : tokens.colors.text.primary,
                          textDecoration: event.completed ? 'line-through' : 'none',
                        }}>
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{event.date}</span>
                          <span className="text-xs font-bold" style={{
                            color: event.daysLeft <= 0 ? tokens.colors.text.muted
                              : event.daysLeft <= 7 ? '#ef4444'
                              : event.daysLeft <= 30 ? '#f97316' : '#22c55e',
                          }}>
                            {event.daysLeft <= 0 ? '已过期' : `还剩 ${event.daysLeft} 天`}
                          </span>
                        </div>
                        {event.notes && (
                          <p className="text-sm mt-2" style={{ color: tokens.colors.text.secondary }}>{event.notes}</p>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      {canEdit && (
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => onToggleComplete(event.id)}
                            className="p-1.5 rounded-lg transition"
                            title={event.completed ? '标记未完成' : '标记完成'}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Check size={16} style={{ color: event.completed ? '#22c55e' : tokens.colors.text.muted }} />
                          </button>
                          <button onClick={() => onEdit(event)}
                            className="p-1.5 rounded-lg transition"
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Edit size={16} style={{ color: '#3b82f6' }} />
                          </button>
                          <button onClick={() => onDelete(event.id)}
                            className="p-1.5 rounded-lg transition"
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Trash2 size={16} style={{ color: '#ef4444' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {events.length === 0 && (
        <div className="text-center py-12">
          <Clock size={48} className="mx-auto mb-4" style={{ color: tokens.colors.text.muted, opacity: 0.5 }} />
          <p style={{ color: tokens.colors.text.muted }}>暂无时间线事项</p>
        </div>
      )}
    </div>
  );
};

export default TimelineLinear;
