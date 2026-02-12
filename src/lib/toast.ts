/**
 * Toast 通知工具函数
 * 封装 sonner 的 toast 方法，提供统一的通知接口
 */
import { toast as sonnerToast } from 'sonner'

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      duration: 3000,
    })
  },

  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      duration: 4000,
    })
  },

  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      duration: 3000,
    })
  },

  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      duration: 3000,
    })
  },

  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    return sonnerToast.promise(promise, messages)
  },
}
