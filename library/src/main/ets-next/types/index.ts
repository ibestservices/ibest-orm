/**
 * 核心类型定义
 */

export type Class<T = unknown> = new (...args: unknown[]) => T;

export type ValueType = string | number | boolean | Uint8Array | null;

export type ValuesBucket = Record<string, ValueType>;

/**
 * 字段类型枚举
 */
export enum ColumnType {
  INTEGER = 'INTEGER',
  REAL = 'REAL',
  TEXT = 'TEXT',
  BLOB = 'BLOB'
}

/**
 * 关联类型
 */
export enum RelationType {
  HasOne = 'hasOne',
  HasMany = 'hasMany',
  BelongsTo = 'belongsTo',
  ManyToMany = 'manyToMany'
}

/**
 * 级联操作类型
 */
export enum CascadeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  All = 'all'
}

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * 查询条件操作符
 */
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'notIn' | 'isNull' | 'isNotNull' | 'between';

/**
 * 条件值类型
 */
export type ConditionValue<T = ValueType> =
  | T
  | { eq?: T }
  | { ne?: T }
  | { gt?: T }
  | { gte?: T }
  | { lt?: T }
  | { lte?: T }
  | { like?: string }
  | { in?: T[] }
  | { notIn?: T[] }
  | { between?: [T, T] }
  | { isNull?: boolean };

/**
 * 查询条件对象
 */
export type WhereCondition<T> = {
  [K in keyof T]?: ConditionValue<T[K]>;
};

/**
 * 排序方向
 */
export type OrderDirection = 'asc' | 'desc';

/**
 * ORM 配置
 */
export interface ORMConfig {
  name?: string;
  securityLevel?: number;
  debug?: boolean;
  logLevel?: LogLevel;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  select?: string[];
  limit?: number;
  offset?: number;
  orderBy?: Array<{ field: string; direction: OrderDirection }>;
}
