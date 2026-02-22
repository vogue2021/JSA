import React, { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock, GripVertical } from 'lucide-react';

const EVENT_COLORS = {
  exam: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500', label: '考试' },
  deadline: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500', label: '出愿' },
  contact: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500', label: '联系' },
  document: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500', label: '材料' },
  interview: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500', label: '面试' },
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const CalendarView = ({ events, onUpdateEvent, onAddEvent, user }) => {
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

  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;
  const selectedEvents = selectedDateKey ? (eventsByDate[selectedDateKey] || []) : [];

  return (
    <div className="space-y-6">
      {/* 图例 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-800">日历视图</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(EVENT_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${color.dot}`} />
                <span className="text-xs text-gray-600">{color.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 月份导航 */}
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-800">
              {year}年{month + 1}月
            </h3>
            <button onClick={goToday}
              className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition font-medium">
              今天
            </button>
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 星期头 */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((day, i) => (
            <div key={day} className={`text-center py-2 text-xs font-semibold ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}>
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
                className={`min-h-[80px] sm:min-h-[100px] border-b border-r p-1 cursor-pointer transition-colors
                  ${!dayInfo.inMonth ? 'bg-gray-50' : 'bg-white hover:bg-blue-50/50'}
                  ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : ''}
                  ${isDragOver ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-400' : ''}
                `}
              >
                <div className={`text-xs sm:text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${todayClass ? 'bg-blue-500 text-white' : ''}
                  ${!dayInfo.inMonth ? 'text-gray-300' : dayInfo.date.getDay() === 0 ? 'text-red-500' : dayInfo.date.getDay() === 6 ? 'text-blue-500' : 'text-gray-700'}
                `}>
                  {dayInfo.day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(event => {
                    const color = getColor(event.type);
                    return (
                      <div
                        key={event.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, event)}
                        className={`text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-grab active:cursor-grabbing ${color.bg} ${color.text} ${event.completed ? 'line-through opacity-60' : ''}`}
                        title={event.title}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3}更多</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 选中日期的事件详情 */}
      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-800">
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
              <span className="text-sm font-normal text-gray-500 ml-2">
                星期{WEEKDAYS[selectedDate.getDay()]}
              </span>
            </h4>
            <div className="flex items-center gap-2">
              {onAddEvent && user.role !== 'student' && (
                <button onClick={() => onAddEvent(selectedDateKey)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition">
                  <Plus size={14} /> 添加事件
                </button>
              )}
              <button onClick={() => setSelectedDate(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
          </div>
          {selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map(event => {
                const color = getColor(event.type);
                return (
                  <div key={event.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, event)}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 ${color.border} ${color.bg} ${event.completed ? 'opacity-60' : ''}`}>
                    <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${color.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${event.completed ? 'line-through' : ''}`}>{event.title}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <Clock size={12} />
                        <span>{event.category}</span>
                        {event.daysLeft !== undefined && (
                          <span className={event.daysLeft <= 7 ? 'text-red-600 font-semibold' : ''}>
                            {event.daysLeft > 0 ? `还剩${event.daysLeft}天` : event.daysLeft === 0 ? '今天' : `已过${Math.abs(event.daysLeft)}天`}
                          </span>
                        )}
                      </div>
                      {event.notes && <p className="text-xs text-gray-600 mt-1">{event.notes}</p>}
                    </div>
                    <GripVertical size={16} className="text-gray-300 cursor-grab flex-shrink-0 mt-1" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">当天暂无事件</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
