import React from 'react';

const typeStyles = {
  info: 'bg-primary-600/90 border-primary-500',
  success: 'bg-green-600/90 border-green-500',
  error: 'bg-red-600/90 border-red-500',
  warning: 'bg-yellow-600/90 border-yellow-500'
};

export default function Toast({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg border text-sm font-medium shadow-lg backdrop-blur-sm ${typeStyles[toast.type] || typeStyles.info}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
