import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'lg',
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 end-0 max-w-full flex">
        <div
          className={`w-screen ${widthClasses[width]} bg-white dark:bg-[#0F2830] shadow-2xl border-s border-[#DDE7E5] dark:border-[#1A4452] flex flex-col`}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE7E5] dark:border-[#1A4452]">
            <div>
              <h3 className="font-display text-base font-bold text-[#0C3B4A] dark:text-[#E8F2F0]">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-[#536E75] dark:text-[#8AA4A0] mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[8px] text-[#536E75] dark:text-[#8AA4A0] hover:text-[#10262D] dark:hover:text-[#E8F2F0] hover:bg-[#F4F8F7] dark:hover:bg-[#143540] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Sticky Footer */}
          {footer && (
            <div className="p-4 bg-[#F4F8F7] dark:bg-[#0A2027] border-t border-[#DDE7E5] dark:border-[#1A4452] flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
