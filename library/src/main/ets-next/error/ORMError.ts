/**
 * ORM 错误处理系统
 */

/**
 * 支持的语言
 */
export type Locale = 'zh' | 'en';

/**
 * 当前语言配置
 */
let currentLocale: Locale = 'zh';

/**
 * 设置错误信息语言
 */
export function setErrorLocale(locale: Locale): void {
  currentLocale = locale;
}

/**
 * 获取当前错误信息语言
 */
export function getErrorLocale(): Locale {
  return currentLocale;
}

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 初始化错误 1xxx
  INIT_FAILED = 1001,
  CONTEXT_NOT_FOUND = 1002,
  DATABASE_NOT_FOUND = 1003,

  // 查询错误 2xxx
  TABLE_NOT_SET = 2001,
  INVALID_QUERY = 2002,
  QUERY_FAILED = 2003,

  // 数据错误 3xxx
  TYPE_MISMATCH = 3001,
  REQUIRED_FIELD_MISSING = 3002,
  PRIMARY_KEY_MISSING = 3003,
  VALIDATION_FAILED = 3004,

  // 迁移错误 4xxx
  MIGRATION_FAILED = 4001,
  TABLE_NOT_EXISTS = 4002,
  COLUMN_NOT_EXISTS = 4003,

  // 关联错误 5xxx
  RELATION_NOT_FOUND = 5001,
  FOREIGN_KEY_MISSING = 5002,
  CASCADE_FAILED = 5003,

  // 事务错误 6xxx
  TRANSACTION_FAILED = 6001,
  ROLLBACK_FAILED = 6002,

  // 软删除错误 7xxx
  SOFT_DELETE_NOT_CONFIGURED = 7001
}

/**
 * 错误信息模板
 */
const ERROR_MESSAGES: Record<ErrorCode, { zh: string; en: string }> = {
  [ErrorCode.INIT_FAILED]: {
    zh: 'ORM 初始化失败',
    en: 'ORM initialization failed'
  },
  [ErrorCode.CONTEXT_NOT_FOUND]: {
    zh: '未找到应用上下文，请确保在 Ability 生命周期内初始化',
    en: 'Application context not found'
  },
  [ErrorCode.DATABASE_NOT_FOUND]: {
    zh: '数据库连接未建立',
    en: 'Database connection not established'
  },
  [ErrorCode.TABLE_NOT_SET]: {
    zh: '未设置数据表，请先调用 Table() 或 Session() 方法',
    en: 'Table not set, call Table() or Session() first'
  },
  [ErrorCode.INVALID_QUERY]: {
    zh: '无效的查询条件',
    en: 'Invalid query condition'
  },
  [ErrorCode.QUERY_FAILED]: {
    zh: '查询执行失败',
    en: 'Query execution failed'
  },
  [ErrorCode.TYPE_MISMATCH]: {
    zh: '字段类型不匹配',
    en: 'Field type mismatch'
  },
  [ErrorCode.REQUIRED_FIELD_MISSING]: {
    zh: '必填字段缺失',
    en: 'Required field missing'
  },
  [ErrorCode.PRIMARY_KEY_MISSING]: {
    zh: '主键值缺失',
    en: 'Primary key value missing'
  },
  [ErrorCode.VALIDATION_FAILED]: {
    zh: '数据验证失败',
    en: 'Data validation failed'
  },
  [ErrorCode.MIGRATION_FAILED]: {
    zh: '数据库迁移失败',
    en: 'Database migration failed'
  },
  [ErrorCode.TABLE_NOT_EXISTS]: {
    zh: '数据表不存在',
    en: 'Table does not exist'
  },
  [ErrorCode.COLUMN_NOT_EXISTS]: {
    zh: '字段不存在',
    en: 'Column does not exist'
  },
  [ErrorCode.RELATION_NOT_FOUND]: {
    zh: '关联关系未找到',
    en: 'Relation not found'
  },
  [ErrorCode.FOREIGN_KEY_MISSING]: {
    zh: '外键值缺失',
    en: 'Foreign key value missing'
  },
  [ErrorCode.CASCADE_FAILED]: {
    zh: '级联操作失败',
    en: 'Cascade operation failed'
  },
  [ErrorCode.TRANSACTION_FAILED]: {
    zh: '事务执行失败',
    en: 'Transaction failed'
  },
  [ErrorCode.ROLLBACK_FAILED]: {
    zh: '事务回滚失败',
    en: 'Transaction rollback failed'
  },
  [ErrorCode.SOFT_DELETE_NOT_CONFIGURED]: {
    zh: '软删除未配置',
    en: 'Soft delete not configured'
  }
};

/**
 * ORM 基础错误类
 */
export class ORMError extends Error {
  readonly code: ErrorCode;
  readonly table?: string;
  readonly field?: string;
  readonly suggestion?: string;
  readonly cause?: Error;

  constructor(options: {
    code: ErrorCode;
    message?: string;
    table?: string;
    field?: string;
    suggestion?: string;
    cause?: Error;
  }) {
    const messages = ERROR_MESSAGES[options.code];
    const baseMessage = messages?.[currentLocale] || messages?.zh || '未知错误';
    const fullMessage = options.message || baseMessage;

    super(fullMessage);
    this.name = 'ORMError';
    this.code = options.code;
    this.table = options.table;
    this.field = options.field;
    this.suggestion = options.suggestion;
    this.cause = options.cause;
  }

  /**
   * 格式化错误信息
   */
  format(): string {
    const parts: string[] = [];

    parts.push(`错误: ${this.message}`);

    if (this.table) {
      parts.push(`表: ${this.table}`);
    }

    if (this.field) {
      parts.push(`字段: ${this.field}`);
    }

    if (this.suggestion) {
      parts.push(`建议: ${this.suggestion}`);
    }

    if (this.cause) {
      parts.push(`原因: ${this.cause.message}`);
    }

    return parts.join('\n');
  }
}

/**
 * 验证错误
 */
export class ValidationError extends ORMError {
  readonly errors: Array<{ field: string; message: string }>;

  constructor(options: {
    table?: string;
    errors: Array<{ field: string; message: string }>;
  }) {
    super({
      code: ErrorCode.VALIDATION_FAILED,
      table: options.table,
      message: `数据验证失败: ${options.errors.map(e => e.message).join('; ')}`
    });
    this.name = 'ValidationError';
    this.errors = options.errors;
  }
}

/**
 * 查询错误
 */
export class QueryError extends ORMError {
  readonly sql?: string;

  constructor(options: {
    message?: string;
    table?: string;
    sql?: string;
    cause?: Error;
  }) {
    super({
      code: ErrorCode.QUERY_FAILED,
      message: options.message,
      table: options.table,
      cause: options.cause
    });
    this.name = 'QueryError';
    this.sql = options.sql;
  }
}

/**
 * 迁移错误
 */
export class MigrationError extends ORMError {
  constructor(options: {
    message?: string;
    table?: string;
    cause?: Error;
  }) {
    super({
      code: ErrorCode.MIGRATION_FAILED,
      message: options.message,
      table: options.table,
      cause: options.cause
    });
    this.name = 'MigrationError';
  }
}
