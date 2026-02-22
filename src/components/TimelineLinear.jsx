import React from 'react';
import { AlertCircle, Check, Edit, Trash2, Clock } from 'lucide-react';

const TimelineLinear = ({ events, user, onToggleComplete, onEdit, onDelete }) => {
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
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{monthEvents.length} 个事项</span>
          </div>

          {/* 时间线 */}
          <div className="relative pl-8">
            {/* 垂直线 */}
            <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-gray-200" />

            {monthEvents.map((event, idx) => {
              const color = getTypeColor(event.type);
              const isLast = idx === monthEvents.length - 1;

              return (
                <div key={event.id} className={`relative flex gap-4 ${!isLast ? 'pb-6' : 'pb-2'}`}>
                  {/* 时间线节点 */}
                  <div className="absolute left-[-17px] flex flex-col items-center">
                    <div className={`w-4 h-4 rounded-full ${event.completed ? 'bg-green-500' : color.dot} border-2 border-white shadow-sm z-10 flex items-center justify-center`}>
                      {event.completed && <Check size={10} className="text-white" />}
                    </div>
                  </div>

                  {/* 事件卡片 */}
                  <div className={`flex-1 ${color.bg} rounded-lg border p-4 transition-all hover:shadow-md ${event.completed ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getTypeIcon(event.type)}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 bg-white rounded-full">{event.category}</span>
                          {event.urgent && (
                            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
                              <AlertCircle size={12} /> 紧急
                            </span>
                          )}
                          {event.schoolId && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">学校关联</span>
                          )}
                        </div>
                        <h4 className={`font-bold text-base ${event.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">{event.date}</span>
                          <span className={`text-xs font-bold ${
                            event.daysLeft <= 0 ? 'text-gray-500' :
                            event.daysLeft <= 7 ? 'text-red-600' :
                            event.daysLeft <= 30 ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {event.daysLeft <= 0 ? '已过期' : `还剩 ${event.daysLeft} 天`}
                          </span>
                        </div>
                        {event.notes && (
                          <p className="text-sm text-gray-600 mt-2">{event.notes}</p>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      {canEdit && (
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => onToggleComplete(event.id)}
                            className="p-1.5 hover:bg-white rounded-lg transition"
                            title={event.completed ? '标记未完成' : '标记完成'}
                          >
                            <Check size={16} className={event.completed ? 'text-green-600' : 'text-gray-400'} />
                          </button>
                          <button onClick={() => onEdit(event)} className="p-1.5 hover:bg-white rounded-lg transition">
                            <Edit size={16} className="text-blue-500" />
                          </button>
                          <button onClick={() => onDelete(event.id)} className="p-1.5 hover:bg-white rounded-lg transition">
                            <Trash2 size={16} className="text-red-500" />
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
        <div className="text-center py-12 text-gray-400">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无时间线事项</p>
        </div>
      )}
    </div>
  );
};

export default TimelineLinear;
