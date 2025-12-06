export { camelToSnake, snakeToCamel, lowerFirst, upperFirst, classToTable, propertyToColumn } from './naming';

/**
 * 时间格式配置
 */
export type TimeFormat = 'datetime' | 'date' | 'time' | 'timestamp' | 'iso';

/**
 * 时间格式化配置
 */
interface TimeFormatConfig {
  format: TimeFormat;
  customFormat?: string;
}

let globalTimeConfig: TimeFormatConfig = { format: 'datetime' };

/**
 * 设置全局时间格式
 */
export function setTimeFormat(format: TimeFormat, customFormat?: string): void {
  globalTimeConfig = { format, customFormat };
}

/**
 * 获取当前时间格式配置
 */
export function getTimeFormat(): TimeFormatConfig {
  return { ...globalTimeConfig };
}

/**
 * 获取本地时间字符串
 */
export function getLocalTimeString(format?: TimeFormat): string {
  const date = new Date();
  const useFormat = format || globalTimeConfig.format;
  return formatDate(date, useFormat);
}

/**
 * 格式化日期
 */
export function formatDate(date: Date, format: TimeFormat): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  switch (format) {
    case 'datetime':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hours}:${minutes}:${seconds}`;
    case 'timestamp':
      return String(date.getTime());
    case 'iso':
      return date.toISOString();
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * 判断是否为空值
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * 判断是否为普通对象
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
