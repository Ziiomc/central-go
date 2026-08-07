import React from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, X, ShieldAlert, CheckCircle, Trash2 } from 'lucide-react';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationAsRead, clearAllNotifications } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col justify-between p-6">
          <div className="space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                <h2 className="font-extrabold text-base text-white">Centro de Notificaciones</h2>
              </div>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  No hay notificaciones sin leer.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationAsRead(n.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-1 ${
                      n.type === 'sos'
                        ? 'bg-red-950/40 border-red-500 text-red-200 animate-pulse'
                        : n.read
                        ? 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                        : 'bg-slate-900 border-slate-700 text-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{n.title}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(n.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition border border-slate-800"
            >
              <Trash2 className="w-4 h-4" /> Limpiar Notificaciones
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
