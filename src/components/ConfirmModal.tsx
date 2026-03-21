import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className={cn(
            "mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4",
            variant === 'danger' ? "bg-red-100 text-red-600" : 
            variant === 'warning' ? "bg-amber-100 text-amber-600" : 
            "bg-blue-100 text-blue-600"
          )}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-black text-black mb-2">{title}</h3>
          <p className="text-sm text-gray-500 font-medium leading-relaxed">
            {message}
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-lg shadow-opacity-20",
              variant === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" : 
              variant === 'warning' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20" : 
              "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
