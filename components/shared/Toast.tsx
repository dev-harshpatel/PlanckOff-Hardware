
import React, { useEffect } from 'react';
import { Toast as ToastModel, ToastType } from '../../types';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from './icons';

interface ToastProps {
  toast: ToastModel;
  onDismiss: (id: number) => void;
}

const toastConfig: { [key in ToastType]: { icon: React.FC<{ className?: string }>, baseColor: string } } = {
  success: {
    icon: CheckCircleIcon,
    baseColor: 'green',
  },
  error: {
    icon: XCircleIcon,
    baseColor: 'red',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    baseColor: 'amber',
  },
  info: {
    icon: InformationCircleIcon,
    baseColor: 'blue',
  },
};

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { id, type, message, details } = toast;
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    // Errors require manual dismissal to ensure the user sees the details
    if (type === 'error') return;

    const timer = setTimeout(() => {
      onDismiss(id);
    }, 5000); // Auto-dismiss after 5 seconds for success/warning

    return () => {
      clearTimeout(timer);
    };
  }, [id, onDismiss, type]);

  return (
    <div
      className={`
        w-full max-w-md overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5
        transform transition-all duration-300 ease-out pointer-events-auto
      `}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 text-${config.baseColor}-500`} aria-hidden="true" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-gray-900">{message}</p>
            {details && (
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {details}
              </p>
            )}
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              onClick={() => onDismiss(id)}
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
