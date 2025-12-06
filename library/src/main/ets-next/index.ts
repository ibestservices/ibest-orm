/**
 * IBest-ORM Next
 * 轻量易用的 HarmonyOS ORM 工具库
 */

// 核心
export { ORM, initORMWithMemory, getORM, setORM, initORM, InitORMOptions, MigrationLog, IBestORMInit, IBestORMInitOptions } from './core';

// 类型
export {
  Class,
  ValueType,
  ValuesBucket,
  ColumnType,
  RelationType,
  CascadeType,
  LogLevel,
  ORMConfig,
  WhereCondition,
  OrderDirection
} from './types';

// 装饰器
export {
  Table,
  Column,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  SoftDelete,
  NotNull,
  HasOne,
  HasMany,
  BelongsTo,
  ManyToMany
} from './decorator';

// 查询
export { QueryBuilder } from './query';

// 错误
export { ORMError, ValidationError, QueryError, MigrationError, ErrorCode, Locale, setErrorLocale, getErrorLocale } from './error';

// 日志
export { Logger, getLogger } from './logger';

// 适配器
export { DatabaseAdapter, BaseAdapter, MemoryAdapter, RelationalStoreAdapter, StoreConfig, createRelationalStoreAdapter } from './adapter';

// 元数据
export { metadataStorage, EntityMetadata, ColumnMetadata, RelationMetadata } from './types/metadata';

// 工具函数
export { camelToSnake, snakeToCamel, classToTable } from './utils/naming';
export { setTimeFormat, getTimeFormat, formatDate, TimeFormat } from './utils';

// 关联（延迟加载、级联操作）
export { enableLazyLoading, clearLazyCache, isRelationLoaded, CascadeHandler, createCascadeHandler } from './relation';

// 验证
export {
  validate,
  Required,
  Length,
  Range,
  Pattern,
  Email,
  Min,
  Max,
  ValidationError as ValidatorError,
  ValidationResult,
  clearValidationMetadata
} from './validator';

// 缓存
export { QueryCache, CacheConfig, getQueryCache, initQueryCache } from './cache';

// 测试
export { runAllTests, getTestStats, TestResult, TestSuite, TestStats } from './__tests__/TestRunner';
export { runAllIntegrationTests, runIntegrationTests, runPerformanceTests, IntegrationTestStats, PerformanceResult } from './__tests__/integration.test';
