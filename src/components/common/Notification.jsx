import React from 'react';
import { CheckSquare, AlertCircle, X } from 'lucide-react';

const Notification = ({ notification, onClose }) => {
  if (!notification) return null;

  const { message, type } = notification;
  const isSuccess = type === 'success';

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-up">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
        isSuccess ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
      }`}>
        {isSuccess ? <CheckSquare size={18} /> : <AlertCircle size={18} />}
        <span className="font-medium text-sm">{message}</span>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-white rounded">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Notification;
