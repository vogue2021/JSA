import React, { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock, GripVertical } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const EVENT_COLORS = {
  exam: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500', label: '考试' },
  deadline: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500', label: '出愿' },
  document: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500', label: '材料' },
  interview: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500', label: '面试' },
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const CalendarView = ({ events, onUpdateEvent, onAddEvent, user }) => {
  const { isDark, tokens, glassEnabled } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // 获取日历网格数据
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // 上月尾部
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, inMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
    }
    // 当月
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, inMonth: true, date: new Date(year, month, i) });
    }
    // 下月头部
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, inMonth: false, date: new Date(year, month + 1, i) });
    }
    return days;
  }, [year, month]);

  // 按日期索引事件
  const eventsByDate = useMemo(() => {
    const map = {};
    (events || []).forEach(event => {
      if (event.date) {
        const key = event.date;
        if (!map[key]) map[key] = [];
        map[key].push(event);
      }
    });
    return map;
  }, [events]);

  const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  // 拖拽处理
  const handleDragStart = (e, event) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
  };

  const handleDragOver = (e, dateKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateKey);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e, dateKey) => {
    e.preventDefault();
    setDragOverDate(null);
    if (draggedEvent && onUpdateEvent) {
      // 计算新日期的daysLeft
      const newDate = new Date(dateKey);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = newDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      onUpdateEvent(draggedEvent.id, { date: dateKey, daysLeft });
    }
    setDraggedEvent(null);
  };

  const getColor = (type) => EVENT_COLORS[type] || EVENT_COLORS.document;

  // 暗色模式下事件颜色
  const getDarkEventStyle = (type) => {
    const darkColors = {
      exam: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
      deadline: { bg: 'rgba(249,115,22,0.15)', text: '#fdba74', border: 'rgba(249,115,22,0.3)' },
      contact: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
      document: { bg: 'rgba(34,197,94,0.15)', text: '#86efac', border: 'rgba(34,197,94,0.3)' },
      interview: { bg: 'rgba(168,85,247,0.15)', text: '#c4b5fd', border: 'rgba(168,85,247,0.3)' },
    };
    return darkColors[type] || darkColors.document;
  };

  // 玻璃卡片通用样式
  const glassCardStyle = glassEnabled ? {
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

  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;
  const selectedEvents = selectedDateKey ? (eventsByDate[selectedDateKey] || []) : [];

  return (
    <div className="space-y-6">
      {/* 图例 */}
      <div className="rounded-xl p-4" style={glassCardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold" style={{ color: tokens.colors.text.primary }}>日历视图</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(EVENT_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${color.dot}`} />
                <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{color.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={glassCardStyle}>
        {/* 月份导航 */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
          <button onClick={prevMonth} className="p-2 rounded-lg transition"
            style={{ color: tokens.colors.text.secondary }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold" style={{ color: tokens.colors.text.primary }}>
              {year}年{month + 1}月
            </h3>
            <button onClick={goToday}
              className="px-3 py-1 text-xs rounded-full font-medium transition"
              style={{
                background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(59,130,246,0.1)',
                color: tokens.colors.accent.primary,
              }}>
              今天
            </button>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg transition"
            style={{ color: tokens.colors.text.secondary }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 星期头 */}
        <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
          {WEEKDAYS.map((day, i) => (
            <div key={day} className="text-center py-2 text-xs font-semibold"
              style={{ color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : tokens.colors.text.muted }}>
              {day}
            </div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7">
          {calendarDays.map((dayInfo, idx) => {
            const dateKey = formatDateKey(dayInfo.date);
            const dayEvents = eventsByDate[dateKey] || [];
            const isSelected = selectedDateKey === dateKey;
            const isDragOver = dragOverDate === dateKey;
            const todayClass = isToday(dayInfo.date);

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(dayInfo.date)}
                onDragOver={(e) => handleDragOver(e, dateKey)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateKey)}
                className="min-h-[80px] sm:min-h-[100px] p-1 cursor-pointer transition-colors"
                style={{
                  borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                  borderRight: `1px solid ${tokens.colors.border.subtle}`,
                  background: isDragOver
                    ? (isDark ? 'rgba(234,179,8,0.1)' : '#fefce8')
                    : isSelected
                      ? (isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff')
                      : !dayInfo.inMonth
                        ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                        : 'transparent',
                  ...(isSelected ? { boxShadow: `inset 0 0 0 2px ${isDark ? 'rgba(96,165,250,0.5)' : '#60a5fa'}` } : {}),
                  ...(isDragOver ? { boxShadow: `inset 0 0 0 2px ${isDark ? 'rgba(250,204,21,0.5)' : '#facc15'}` } : {}),
                }}
              >
                <div className={`text-xs sm:text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${todayClass ? 'bg-blue-500 text-white' : ''}`}
                  style={!todayClass ? {
                    color: !dayInfo.inMonth ? tokens.colors.text.muted
                      : dayInfo.date.getDay() === 0 ? '#ef4444'
                      : dayInfo.date.getDay() === 6 ? '#3b82f6'
                      : tokens.colors.text.secondary,
                    opacity: !dayInfo.inMonth ? 0.4 : 1,
                  } : {}}>
                  {dayInfo.day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(event => {
                    if (isDark) {
                      const dc = getDarkEventStyle(event.type);
                      return (
                        <div key={event.id} draggable onDragStart={(e) => handleDragStart(e, event)}
                          className={`text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-grab active:cursor-grabbing ${event.completed ? 'line-through opacity-60' : ''}`}
                          style={{ background: dc.bg, color: dc.text }}
                          title={event.title} onClick={(e) => e.stopPropagation()}>
                          {event.title}
                        </div>
                      );
                    }
                    const color = getColor(event.type);
                    return (
                      <div key={event.id} draggable onDragStart={(e) => handleDragStart(e, event)}
                        className={`text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-grab active:cursor-grabbing ${color.bg} ${color.text} ${event.completed ? 'line-through opacity-60' : ''}`}
                        title={event.title} onClick={(e) => e.stopPropagation()}>
                        {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] px-1" style={{ color: tokens.colors.text.muted }}>+{dayEvents.length - 3}更多</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 选中日期的事件详情 */}
      {selectedDate && (
        <div className="rounded-xl p-4 animate-fade-in" style={glassCardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold" style={{ color: tokens.colors.text.primary }}>
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
              <span className="text-sm font-normal ml-2" style={{ color: tokens.colors.text.muted }}>
                星期{WEEKDAYS[selectedDate.getDay()]}
              </span>
            </h4>
            <div className="flex items-center gap-2">
              {onAddEvent && user.role !== 'student' && (
                <button onClick={() => onAddEvent(selectedDateKey)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition"
                  style={{ background: tokens.colors.accent.primary, color: '#fff' }}>
                  <Plus size={14} /> 添加事件
                </button>
              )}
              <button onClick={() => setSelectedDate(null)} className="p-1.5 rounded-lg transition"
                style={{ color: tokens.colors.text.muted }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={16} />
              </button>
            </div>
          </div>
          {selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map(event => {
                if (isDark) {
                  const dc = getDarkEventStyle(event.type);
                  return (
                    <div key={event.id} draggable onDragStart={(e) => handleDragStart(e, event)}
                      className={`flex items-start gap-3 p-3 rounded-lg ${event.completed ? 'opacity-60' : ''}`}
                      style={{ background: dc.bg, border: `2px solid ${dc.border}` }}>
                      <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${getColor(event.type).dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium" style={{ color: dc.text, textDecoration: event.completed ? 'line-through' : 'none' }}>{event.title}</div>
                        <div className="text-xs mt-1 flex items-center gap-2" style={{ color: tokens.colors.text.muted }}>
                          <Clock size={12} /><span>{event.category}</span>
                          {event.daysLeft !== undefined && (
                            <span style={{ color: event.daysLeft <= 7 ? '#f87171' : tokens.colors.text.muted, fontWeight: event.daysLeft <= 7 ? 600 : 400 }}>
                              {event.daysLeft > 0 ? `还剩${event.daysLeft}天` : event.daysLeft === 0 ? '今天' : `已过${Math.abs(event.daysLeft)}天`}
                            </span>
                          )}
                        </div>
                        {event.notes && <p className="text-xs mt-1" style={{ color: tokens.colors.text.secondary }}>{event.notes}</p>}
                      </div>
                      <GripVertical size={16} className="cursor-grab flex-shrink-0 mt-1" style={{ color: tokens.colors.text.muted }} />
                    </div>
                  );
                }
                const color = getColor(event.type);
                return (
                  <div key={event.id} draggable onDragStart={(e) => handleDragStart(e, event)}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 ${color.border} ${color.bg} ${event.completed ? 'opacity-60' : ''}`}>
                    <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${color.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${event.completed ? 'line-through' : ''}`}>{event.title}</div>
                      <div className="text-xs mt-1 flex items-center gap-2" style={{ color: tokens.colors.text.muted }}>
                        <Clock size={12} /><span>{event.category}</span>
                        {event.daysLeft !== undefined && (
                          <span className={event.daysLeft <= 7 ? 'text-red-600 font-semibold' : ''}>
                            {event.daysLeft > 0 ? `还剩${event.daysLeft}天` : event.daysLeft === 0 ? '今天' : `已过${Math.abs(event.daysLeft)}天`}
                          </span>
                        )}
                      </div>
                      {event.notes && <p className="text-xs mt-1" style={{ color: tokens.colors.text.secondary }}>{event.notes}</p>}
                    </div>
                    <GripVertical size={16} className="cursor-grab flex-shrink-0 mt-1" style={{ color: tokens.colors.text.muted }} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock size={32} className="mx-auto mb-2" style={{ color: tokens.colors.text.muted, opacity: 0.5 }} />
              <p className="text-sm" style={{ color: tokens.colors.text.muted }}>当天暂无事件</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
