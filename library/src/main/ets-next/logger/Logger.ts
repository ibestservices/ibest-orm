/**
 * 日志系统
 */

import { LogLevel } from '../types';

const TAG = 'ibest-orm';

/**
 * SQL 日志条目
 */
export interface SQLLogEntry {
  sql: string;
  params?: unknown[];
  duration?: number;
  timestamp: number;
}

/**
 * 日志管理器
 */
export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.WARN;
  private sqlLogs: SQLLogEntry[] = [];
  private maxLogs: number = 100;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 获取日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 调试日志
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${TAG}] DEBUG:`, message, ...args);
    }
  }

  /**
   * 信息日志
   */
  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${TAG}] INFO:`, message, ...args);
    }
  }

  /**
   * 警告日志
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${TAG}] WARN:`, message, ...args);
    }
  }

  /**
   * 错误日志
   */
  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${TAG}] ERROR:`, message, ...args);
    }
  }

  /**
   * 记录 SQL 执行
   */
  logSQL(sql: string, params?: unknown[], duration?: number): void {
    const entry: SQLLogEntry = {
      sql,
      params,
      duration,
      timestamp: Date.now()
    };

    this.sqlLogs.push(entry);
    if (this.sqlLogs.length > this.maxLogs) {
      this.sqlLogs.shift();
    }

    if (this.level <= LogLevel.DEBUG) {
      let logMessage = `[${TAG}] SQL: ${sql}`;
      if (params && params.length > 0) {
        logMessage += `\n[${TAG}] Params: ${JSON.stringify(params)}`;
      }
      if (duration !== undefined) {
        logMessage += `\n[${TAG}] Duration: ${duration}ms`;
      }
      console.debug(logMessage);
    }
  }

  /**
   * 获取 SQL 日志
   */
  getSQLLogs(): SQLLogEntry[] {
    return [...this.sqlLogs];
  }

  /**
   * 清空 SQL 日志
   */
  clearSQLLogs(): void {
    this.sqlLogs = [];
  }

  /**
   * 设置最大日志数量
   */
  setMaxLogs(max: number): void {
    this.maxLogs = max;
  }
}

/**
 * 获取日志实例
 */
export function getLogger(): Logger {
  return Logger.getInstance();
}
