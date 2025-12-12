import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const [duration, setDuration] = useState(3000);

  const showToast = useCallback(
    (msg: string, toastType: ToastType = 'info', toastDuration: number = 3000) => {
      setMessage(msg);
      setType(toastType);
      setDuration(toastDuration);
      setVisible(true);
    },
    []
  );

  const showSuccess = useCallback((msg: string, toastDuration: number = 3000) => {
    showToast(msg, 'success', toastDuration);
  }, [showToast]);

  const showError = useCallback((msg: string, toastDuration: number = 4000) => {
    showToast(msg, 'error', toastDuration);
  }, [showToast]);

  const showWarning = useCallback((msg: string, toastDuration: number = 3500) => {
    showToast(msg, 'warning', toastDuration);
  }, [showToast]);

  const showInfo = useCallback((msg: string, toastDuration: number = 3000) => {
    showToast(msg, 'info', toastDuration);
  }, [showToast]);

  const hideToast = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideToast,
      }}
    >
      {children}
      <Toast
        message={message}
        type={type}
        duration={duration}
        visible={visible}
        onHide={hideToast}
      />
    </ToastContext.Provider>
  );
};
