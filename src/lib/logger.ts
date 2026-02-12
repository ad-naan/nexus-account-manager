/**
 * 前端统一日志系统
 * 
 * 提供带颜色的控制台日志输出，方便开发调试
 */

// 日志级别
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

// 日志颜色配置
const LOG_COLORS = {
  [LogLevel.INFO]: '#00BCD4',   // 青色 (Cyan)
  [LogLevel.WARN]: '#FFC107',   // 黄色 (Amber)
  [LogLevel.ERROR]: '#F44336',  // 红色 (Red)
  [LogLevel.DEBUG]: '#9C27B0',  // 紫色 (Purple)
} as const;

// 时间戳颜色
const TIMESTAMP_COLOR = '#9E9E9E'; // 灰色

// 最大日志消息长度
const MAX_LOG_LENGTH = 500;

/**
 * 截断长消息
 */
function truncateMessage(message: string): string {
  if (message.length <= MAX_LOG_LENGTH) {
    return message;
  }
  return `${message.substring(0, MAX_LOG_LENGTH)}... [truncated, total ${message.length} chars]`;
}

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 输出日志
 */
function log(level: LogLevel, message: string, ...args: any[]): void {
  const timestamp = formatTimestamp();
  const truncated = truncateMessage(message);
  const color = LOG_COLORS[level];
  
  // 构建样式
  const timestampStyle = `color: ${TIMESTAMP_COLOR}; font-weight: normal;`;
  const levelStyle = `color: ${color}; font-weight: bold;`;
  const messageStyle = 'color: inherit; font-weight: normal;';
  
  // 输出到控制台
  if (level === LogLevel.ERROR) {
    console.error(
      `%c[${timestamp}]%c ${level}%c ${truncated}`,
      timestampStyle,
      levelStyle,
      messageStyle,
      ...args
    );
  } else if (level === LogLevel.WARN) {
    console.warn(
      `%c[${timestamp}]%c ${level}%c ${truncated}`,
      timestampStyle,
      levelStyle,
      messageStyle,
      ...args
    );
  } else {
    console.log(
      `%c[${timestamp}]%c ${level}%c ${truncated}`,
      timestampStyle,
      levelStyle,
      messageStyle,
      ...args
    );
  }
}

/**
 * 信息日志
 */
export function logInfo(message: string, ...args: any[]): void {
  log(LogLevel.INFO, message, ...args);
}

/**
 * 警告日志
 */
export function logWarn(message: string, ...args: any[]): void {
  log(LogLevel.WARN, message, ...args);
}

/**
 * 错误日志
 */
export function logError(message: string, ...args: any[]): void {
  log(LogLevel.ERROR, message, ...args);
}

/**
 * 调试日志
 */
export function logDebug(message: string, ...args: any[]): void {
  // 仅在开发环境输出调试日志
  if (import.meta.env.DEV) {
    log(LogLevel.DEBUG, message, ...args);
  }
}

/**
 * 日志组 - 用于分组相关日志
 */
export function logGroup(title: string, collapsed: boolean = false): void {
  if (collapsed) {
    console.groupCollapsed(`%c${title}`, `color: ${LOG_COLORS[LogLevel.INFO]}; font-weight: bold;`);
  } else {
    console.group(`%c${title}`, `color: ${LOG_COLORS[LogLevel.INFO]}; font-weight: bold;`);
  }
}

/**
 * 结束日志组
 */
export function logGroupEnd(): void {
  console.groupEnd();
}

/**
 * 表格日志 - 用于输出结构化数据
 */
export function logTable(data: any, columns?: string[]): void {
  console.table(data, columns);
}

// 默认导出
export default {
  info: logInfo,
  warn: logWarn,
  error: logError,
  debug: logDebug,
  group: logGroup,
  groupEnd: logGroupEnd,
  table: logTable,
};
