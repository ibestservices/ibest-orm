/**
 * 核心 ORM 类
 */

import { Class, ORMConfig, LogLevel, ColumnType, ValueType, ValuesBucket } from '../types';
import { metadataStorage, EntityMetadata, ColumnMetadata } from '../types/metadata';
import { DatabaseAdapter } from '../adapter/BaseAdapter';
import { MemoryAdapter } from '../adapter/MemoryAdapter';
import { createRelationalStoreAdapter } from '../adapter/RelationalStoreAdapter';
import { QueryBuilder } from '../query/QueryBuilder';
import { ORMError, ErrorCode } from '../error';
import { Logger, getLogger } from '../logger';
import { classToTable, getLocalTimeString } from '../utils';

/**
 * 迁移日志记录
 */
export interface MigrationLog {
  id?: number;
  tableName: string;
  action: 'create_table' | 'add_column' | 'drop_column' | 'modify_column';
  columnName?: string;
  sql: string;
  executedAt: string;
}

/**
 * ORM 实例
 */
export class ORM {
  private adapter: DatabaseAdapter;
  private config: ORMConfig;
  private logger: Logger;
  private migrationLogs: MigrationLog[] = [];
  private transactionDepth: number = 0;

  constructor(adapter: DatabaseAdapter, config: ORMConfig = {}) {
    this.adapter = adapter;
    this.config = {
      name: config.name || 'app.db',
      debug: config.debug || false,
      logLevel: config.logLevel ?? (config.debug ? LogLevel.DEBUG : LogLevel.WARN)
    };

    this.logger = getLogger();
    this.logger.setLevel(this.config.logLevel!);
  }

  /**
   * 获取查询构建器
   */
  query<T>(entityClass: Class<T>): QueryBuilder<T> {
    return new QueryBuilder<T>(this.adapter).from(entityClass);
  }

  /**
   * 获取表查询构建器
   */
  table(name: string): QueryBuilder {
    return new QueryBuilder(this.adapter).table(name);
  }

  /**
   * 自动迁移
   */
  migrate(...entities: Class[]): void {
    for (const entity of entities) {
      this.migrateEntity(entity);
    }
  }

  /**
   * 插入实体
   */
  insert<T extends object>(entity: T | T[]): number {
    if (Array.isArray(entity)) {
      let count = 0;
      for (const e of entity) {
        if (this.insertSingle(e) > 0) count++;
      }
      return count;
    }
    return this.insertSingle(entity);
  }

  /**
   * 保存实体（有主键更新，无主键插入）
   */
  save<T extends object>(entity: T): number {
    const entityClass = entity.constructor as Class<T>;
    const metadata = metadataStorage.getEntityMetadata(entityClass);

    if (!metadata?.primaryKey) {
      return this.insertSingle(entity);
    }

    const pkValue = (entity as Record<string, unknown>)[metadata.primaryKey.propertyKey];
    if (pkValue) {
      return this.updateSingle(entity);
    }

    return this.insertSingle(entity);
  }

  /**
   * 删除实体
   */
  delete<T extends object>(entity: T): number {
    const entityClass = entity.constructor as Class<T>;
    const metadata = metadataStorage.getEntityMetadata(entityClass);
    const tableName = metadata?.table.name || classToTable(entityClass.name);

    if (!metadata?.primaryKey) {
      throw new ORMError({
        code: ErrorCode.PRIMARY_KEY_MISSING,
        table: tableName,
        suggestion: '删除操作需要实体定义主键'
      });
    }

    const pkValue = (entity as Record<string, unknown>)[metadata.primaryKey.propertyKey];
    if (!pkValue) {
      throw new ORMError({
        code: ErrorCode.PRIMARY_KEY_MISSING,
        table: tableName,
        suggestion: '删除操作需要实体有主键值'
      });
    }

    return this.adapter.delete(tableName, `${metadata.primaryKey.name} = ?`, [pkValue as ValueType]);
  }

  /**
   * 根据主键删除
   */
  deleteById<T>(entityClass: Class<T>, id: number | number[]): number {
    const metadata = metadataStorage.getEntityMetadata(entityClass);
    const tableName = metadata?.table.name || classToTable(entityClass.name);
    const pkName = metadata?.primaryKey?.name || 'id';

    if (Array.isArray(id)) {
      let count = 0;
      for (const i of id) {
        count += this.adapter.delete(tableName, `${pkName} = ?`, [i]);
      }
      return count;
    }

    return this.adapter.delete(tableName, `${pkName} = ?`, [id]);
  }

  /**
   * 开始事务（支持嵌套）
   * 注意：HarmonyOS RelationalStore 不支持 SAVEPOINT，嵌套事务仅跟踪深度
   */
  beginTransaction(): void {
    if (this.transactionDepth === 0) {
      this.adapter.beginTransaction();
    }
    // 嵌套事务仅增加深度计数，不创建 SAVEPOINT
    this.transactionDepth++;
  }

  /**
   * 提交事务（支持嵌套）
   */
  commit(): void {
    if (this.transactionDepth <= 0) return;
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      this.adapter.commit();
    }
    // 嵌套事务仅减少深度计数
  }

  /**
   * 回滚事务（支持嵌套）
   * 注意：内层回滚会标记整个事务需要回滚
   */
  rollback(): void {
    if (this.transactionDepth <= 0) return;
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      this.adapter.rollback();
    }
    // 嵌套事务仅减少深度计数，实际回滚在最外层
  }

  /**
   * 获取当前事务深度
   */
  getTransactionDepth(): number {
    return this.transactionDepth;
  }

  /**
   * 事务执行（自动提交/回滚，支持嵌套）
   */
  async transaction<R>(fn: (orm: ORM) => Promise<R>): Promise<R> {
    this.beginTransaction();
    try {
      const result = await fn(this);
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * 执行原生 SQL
   */
  executeSql(sql: string, params?: ValueType[]): void {
    const startTime = Date.now();
    this.adapter.executeSqlSync(sql, params);
    this.logger.logSQL(sql, params, Date.now() - startTime);
  }

  /**
   * 获取适配器
   */
  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.adapter.close();
  }

  /**
   * 检查表是否存在
   */
  hasTable(entity: Class | string): boolean {
    const tableName = typeof entity === 'string' ? entity : this.getTableName(entity);
    const sql = `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`;
    const result = this.adapter.query(sql);
    const exists = result.rowCount > 0;
    result.close();
    return exists;
  }

  /**
   * 获取表信息
   */
  getTableInfo(entity: Class | string): { name: string; type: string; notnull: boolean; pk: boolean }[] {
    const tableName = typeof entity === 'string' ? entity : this.getTableName(entity);
    const sql = `PRAGMA table_info('${tableName}')`;
    const result = this.adapter.query(sql);
    const columns: { name: string; type: string; notnull: boolean; pk: boolean }[] = [];

    if (result.goToFirstRow()) {
      while (!result.isEnded) {
        columns.push({
          name: result.getValue(result.getColumnIndex('name')) as string,
          type: result.getValue(result.getColumnIndex('type')) as string,
          notnull: (result.getValue(result.getColumnIndex('notnull')) as number) === 1,
          pk: (result.getValue(result.getColumnIndex('pk')) as number) === 1
        });
        result.goToNextRow();
      }
    }
    result.close();
    return columns;
  }

  /**
   * 检查列是否存在
   */
  hasColumn(entity: Class | string, columnName: string): boolean {
    const columns = this.getTableInfo(entity);
    return columns.some(col => col.name === columnName);
  }

  private getTableName(entity: Class): string {
    const metadata = metadataStorage.getEntityMetadata(entity);
    return metadata?.table.name || classToTable(entity.name);
  }

  /**
   * 获取迁移日志
   */
  getMigrationLogs(): MigrationLog[] {
    return [...this.migrationLogs];
  }

  /**
   * 清空迁移日志
   */
  clearMigrationLogs(): void {
    this.migrationLogs = [];
  }

  /**
   * 查询迁移历史（从数据库）
   */
  getMigrationHistory(): MigrationLog[] {
    this.ensureMigrationTable();
    const sql = 'SELECT * FROM __orm_migrations ORDER BY id DESC';
    const result = this.adapter.query(sql);
    const logs: MigrationLog[] = [];

    if (result.goToFirstRow()) {
      while (!result.isEnded) {
        logs.push({
          id: result.getValue(result.getColumnIndex('id')) as number,
          tableName: result.getValue(result.getColumnIndex('table_name')) as string,
          action: result.getValue(result.getColumnIndex('action')) as MigrationLog['action'],
          columnName: result.getValue(result.getColumnIndex('column_name')) as string | undefined,
          sql: result.getValue(result.getColumnIndex('sql')) as string,
          executedAt: result.getValue(result.getColumnIndex('executed_at')) as string
        });
        result.goToNextRow();
      }
    }
    result.close();
    return logs;
  }

  // ========== 私有方法 ==========

  private ensureMigrationTable(): void {
    const sql = `CREATE TABLE IF NOT EXISTS __orm_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      column_name TEXT,
      sql TEXT NOT NULL,
      executed_at TEXT NOT NULL
    )`;
    this.adapter.executeSqlSync(sql);
  }

  private logMigration(log: Omit<MigrationLog, 'id' | 'executedAt'>): void {
    const now = getLocalTimeString();
    const fullLog: MigrationLog = { ...log, executedAt: now };
    this.migrationLogs.push(fullLog);

    // 持久化到数据库
    try {
      this.ensureMigrationTable();
      const rowId = this.adapter.insert('__orm_migrations', {
        table_name: log.tableName,
        action: log.action,
        column_name: log.columnName || null,
        sql: log.sql,
        executed_at: now
      });
      this.logger.debug(`迁移日志已写入，rowId: ${rowId}`);
    } catch (e) {
      this.logger.warn(`迁移日志写入失败: ${e}`);
    }
  }

  private insertSingle<T extends object>(entity: T): number {
    const entityClass = entity.constructor as Class<T>;
    const metadata = metadataStorage.getEntityMetadata(entityClass);
    const tableName = metadata?.table.name || classToTable(entityClass.name);

    const values = this.entityToValues(entity, metadata, true);
    const rowId = this.adapter.insert(tableName, values);

    // 回写主键
    if (metadata?.primaryKey && rowId > 0) {
      (entity as Record<string, unknown>)[metadata.primaryKey.propertyKey] = rowId;
    }

    return rowId;
  }

  private updateSingle<T extends object>(entity: T): number {
    const entityClass = entity.constructor as Class<T>;
    const metadata = metadataStorage.getEntityMetadata(entityClass);
    const tableName = metadata?.table.name || classToTable(entityClass.name);

    if (!metadata?.primaryKey) {
      throw new ORMError({
        code: ErrorCode.PRIMARY_KEY_MISSING,
        table: tableName
      });
    }

    const pkValue = (entity as Record<string, unknown>)[metadata.primaryKey.propertyKey];
    const values = this.entityToValues(entity, metadata, false);

    return this.adapter.update(tableName, values, `${metadata.primaryKey.name} = ?`, [pkValue as ValueType]);
  }

  private entityToValues<T extends object>(entity: T, metadata: EntityMetadata | undefined, isInsert: boolean): ValuesBucket {
    const values: ValuesBucket = {};
    const now = getLocalTimeString();

    if (metadata) {
      for (const col of metadata.columns) {
        // 跳过自增主键
        if (isInsert && col.isPrimaryKey && col.isAutoIncrement) continue;
        // 跳过主键更新
        if (!isInsert && col.isPrimaryKey) continue;

        if (col.isAutoCreateTime && isInsert) {
          values[col.name] = now;
        } else if (col.isAutoUpdateTime) {
          values[col.name] = now;
        } else {
          const value = (entity as Record<string, unknown>)[col.propertyKey];
          if (value !== undefined) {
            values[col.name] = value as ValueType;
          }
        }
      }
    } else {
      // 无元数据，直接使用对象属性
      for (const [key, value] of Object.entries(entity)) {
        if (value !== undefined) {
          values[key] = value as ValueType;
        }
      }
    }

    return values;
  }

  private migrateEntity(entityClass: Class): void {
    const metadata = metadataStorage.getEntityMetadata(entityClass);
    if (!metadata) {
      this.logger.warn(`实体 ${entityClass.name} 未注册元数据`);
      return;
    }

    const tableName = metadata.table.name;

    // 检查表是否存在
    const checkSql = `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`;
    const result = this.adapter.query(checkSql);
    const tableExists = result.rowCount > 0;
    result.close();

    if (!tableExists) {
      // 创建表
      const createSql = this.buildCreateTableSQL(tableName, metadata);
      this.logger.debug(`创建表: ${createSql}`);
      this.adapter.executeSqlSync(createSql);
      this.logMigration({ tableName, action: 'create_table', sql: createSql });
    } else {
      // 同步字段
      this.syncColumns(tableName, metadata.columns);
    }
  }

  private buildCreateTableSQL(tableName: string, metadata: EntityMetadata): string {
    const isCompositePK = metadata.primaryKeys.length > 1;

    const columnDefs = metadata.columns.map(col => {
      const parts = [col.name, col.type];

      if (col.isNotNull) parts.push('NOT NULL');
      // 单主键时在列定义中添加 PRIMARY KEY
      if (col.isPrimaryKey && !isCompositePK) parts.push('PRIMARY KEY');
      if (col.isAutoIncrement && col.type === ColumnType.INTEGER && !isCompositePK) parts.push('AUTOINCREMENT');
      if (col.isAutoCreateTime || col.isAutoUpdateTime) {
        parts.push("DEFAULT (DATETIME('now', 'localtime'))");
      }

      return parts.join(' ');
    });

    // 复合主键时添加表级约束
    if (isCompositePK) {
      const pkNames = metadata.primaryKeys.map(pk => pk.name).join(', ');
      columnDefs.push(`PRIMARY KEY (${pkNames})`);
    }

    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs.join(', ')});`;
  }

  private syncColumns(tableName: string, columns: ColumnMetadata[]): void {
    const infoSql = `PRAGMA table_info('${tableName}')`;
    const result = this.adapter.query(infoSql);

    const existingColumns = new Set<string>();
    if (result.goToFirstRow()) {
      while (!result.isEnded) {
        const nameIndex = result.getColumnIndex('name');
        existingColumns.add(result.getValue(nameIndex) as string);
        result.goToNextRow();
      }
    }
    result.close();

    // 添加新字段
    for (const col of columns) {
      if (!existingColumns.has(col.name)) {
        const parts = [col.name, col.type];
        if (col.isNotNull) parts.push('NOT NULL');

        const alterSql = `ALTER TABLE ${tableName} ADD COLUMN ${parts.join(' ')}`;
        this.logger.debug(`添加字段: ${alterSql}`);
        this.adapter.executeSqlSync(alterSql);
        this.logMigration({ tableName, action: 'add_column', columnName: col.name, sql: alterSql });
      }
    }
  }

  /**
   * 删除字段（带数据备份）
   * SQLite 不支持 DROP COLUMN，需要重建表
   */
  dropColumn(tableName: string, columnName: string, backup: boolean = true): void {
    // 1. 获取现有表结构
    const infoSql = `PRAGMA table_info('${tableName}')`;
    const result = this.adapter.query(infoSql);

    const columns: { name: string; type: string; notnull: number; pk: number }[] = [];
    if (result.goToFirstRow()) {
      while (!result.isEnded) {
        const name = result.getValue(result.getColumnIndex('name')) as string;
        if (name !== columnName) {
          columns.push({
            name,
            type: result.getValue(result.getColumnIndex('type')) as string,
            notnull: result.getValue(result.getColumnIndex('notnull')) as number,
            pk: result.getValue(result.getColumnIndex('pk')) as number
          });
        }
        result.goToNextRow();
      }
    }
    result.close();

    if (columns.length === 0) {
      this.logger.warn(`表 ${tableName} 不存在或无法删除所有字段`);
      return;
    }

    const tempTable = `${tableName}_backup_${Date.now()}`;
    const columnNames = columns.map(c => c.name).join(', ');

    // 2. 备份数据到临时表
    if (backup) {
      const backupSql = `CREATE TABLE ${tempTable} AS SELECT ${columnNames} FROM ${tableName}`;
      this.adapter.executeSqlSync(backupSql);
      this.logger.debug(`备份数据: ${backupSql}`);
    }

    // 3. 删除原表
    this.adapter.executeSqlSync(`DROP TABLE ${tableName}`);

    // 4. 创建新表（不含被删除的字段）
    const columnDefs = columns.map(c => {
      const parts = [c.name, c.type];
      if (c.notnull) parts.push('NOT NULL');
      if (c.pk) parts.push('PRIMARY KEY');
      return parts.join(' ');
    });
    const createSql = `CREATE TABLE ${tableName} (${columnDefs.join(', ')})`;
    this.adapter.executeSqlSync(createSql);

    // 5. 恢复数据
    if (backup) {
      const restoreSql = `INSERT INTO ${tableName} SELECT * FROM ${tempTable}`;
      this.adapter.executeSqlSync(restoreSql);
      this.adapter.executeSqlSync(`DROP TABLE ${tempTable}`);
    }

    this.logMigration({ tableName, action: 'drop_column', columnName, sql: `DROP COLUMN ${columnName}` });
    this.logger.debug(`删除字段: ${tableName}.${columnName}`);
  }

  /**
   * 修改字段类型
   * SQLite 不支持 ALTER COLUMN，需要重建表
   */
  modifyColumn(tableName: string, columnName: string, newType: ColumnType): void {
    // 1. 获取现有表结构
    const infoSql = `PRAGMA table_info('${tableName}')`;
    const result = this.adapter.query(infoSql);

    const columns: { name: string; type: string; notnull: number; pk: number }[] = [];
    if (result.goToFirstRow()) {
      while (!result.isEnded) {
        const name = result.getValue(result.getColumnIndex('name')) as string;
        columns.push({
          name,
          type: name === columnName ? newType : result.getValue(result.getColumnIndex('type')) as string,
          notnull: result.getValue(result.getColumnIndex('notnull')) as number,
          pk: result.getValue(result.getColumnIndex('pk')) as number
        });
        result.goToNextRow();
      }
    }
    result.close();

    if (columns.length === 0) {
      this.logger.warn(`表 ${tableName} 不存在`);
      return;
    }

    const tempTable = `${tableName}_modify_${Date.now()}`;
    const columnNames = columns.map(c => c.name).join(', ');

    // 2. 备份数据
    const backupSql = `CREATE TABLE ${tempTable} AS SELECT ${columnNames} FROM ${tableName}`;
    this.adapter.executeSqlSync(backupSql);

    // 3. 删除原表
    this.adapter.executeSqlSync(`DROP TABLE ${tableName}`);

    // 4. 创建新表（使用新类型）
    const columnDefs = columns.map(c => {
      const parts = [c.name, c.type];
      if (c.notnull) parts.push('NOT NULL');
      if (c.pk) parts.push('PRIMARY KEY');
      return parts.join(' ');
    });
    const createSql = `CREATE TABLE ${tableName} (${columnDefs.join(', ')})`;
    this.adapter.executeSqlSync(createSql);

    // 5. 恢复数据
    const restoreSql = `INSERT INTO ${tableName} SELECT ${columnNames} FROM ${tempTable}`;
    this.adapter.executeSqlSync(restoreSql);
    this.adapter.executeSqlSync(`DROP TABLE ${tempTable}`);

    this.logMigration({ tableName, action: 'modify_column', columnName, sql: `MODIFY ${columnName} ${newType}` });
    this.logger.debug(`修改字段类型: ${tableName}.${columnName} -> ${newType}`);
  }

  /**
   * 生成回滚 SQL
   * 根据迁移日志生成反向操作的 SQL
   */
  generateRollbackSQL(log: MigrationLog): string {
    switch (log.action) {
      case 'create_table':
        return `DROP TABLE IF EXISTS ${log.tableName};`;
      case 'add_column':
        // SQLite 不支持 DROP COLUMN，返回注释说明
        return `-- DROP COLUMN ${log.columnName} FROM ${log.tableName} (需要重建表)`;
      case 'drop_column':
        // 无法恢复已删除的字段，返回注释
        return `-- 无法自动恢复已删除的字段 ${log.columnName}`;
      case 'modify_column':
        // 无法自动恢复原类型，返回注释
        return `-- 无法自动恢复字段 ${log.columnName} 的原类型`;
      default:
        return `-- 未知操作: ${log.action}`;
    }
  }

  /**
   * 生成所有迁移的回滚 SQL
   */
  generateAllRollbackSQL(): string[] {
    return this.migrationLogs.map(log => this.generateRollbackSQL(log)).reverse();
  }
}

// ========== 全局实例管理 ==========

let globalORM: ORM | null = null;

/**
 * 初始化 ORM（使用内存适配器，用于测试和预览器）
 */
export function initORMWithMemory(config?: ORMConfig): ORM {
  const adapter = new MemoryAdapter();
  globalORM = new ORM(adapter, config);
  return globalORM;
}

/**
 * 获取 ORM 实例
 */
export function getORM(): ORM {
  if (!globalORM) {
    throw new ORMError({
      code: ErrorCode.DATABASE_NOT_FOUND,
      suggestion: '请先调用 initORM() 初始化数据库'
    });
  }
  return globalORM;
}

/**
 * 设置 ORM 实例（用于自定义适配器）
 */
export function setORM(orm: ORM): void {
  globalORM = orm;
}

/**
 * 初始化 ORM 配置（用于 RelationalStore）
 */
export interface InitORMOptions extends ORMConfig {
  adapter: DatabaseAdapter;
}

/**
 * 初始化 ORM（通用方法）
 */
export function initORM(options: InitORMOptions): ORM {
  globalORM = new ORM(options.adapter, options);
  return globalORM;
}

/**
 * IBestORMInit 配置选项
 */
export interface IBestORMInitOptions {
  /** 数据库文件名，默认 'ibest.db' */
  name?: string;
  /** 是否开启调试日志，默认 true */
  debug?: boolean;
  /** 日志级别，默认 'debug' */
  logLevel?: LogLevel;
}

/**
 * IBestORMInit - 简化的 ORM 初始化函数
 *
 * 面向用户的快速初始化方法，自动创建 RelationalStoreAdapter
 * 默认开启 debug 日志，使用 'ibest.db' 作为数据库文件名
 *
 * @param context - 应用上下文 (this.context)
 * @param options - 可选配置
 * @returns Promise<ORM> - ORM 实例
 *
 * @example
 * ```ts
 * // 最简单的初始化方式
 * const orm = await IBestORMInit(this.context);
 *
 * // 自定义配置
 * const orm = await IBestORMInit(this.context, {
 *   name: 'myapp.db',
 *   debug: false
 * });
 * ```
 */
export async function IBestORMInit(context: object, options?: IBestORMInitOptions): Promise<ORM> {
  const adapter = await createRelationalStoreAdapter(context as Parameters<typeof createRelationalStoreAdapter>[0], {
    name: options?.name || 'ibest.db'
  });

  return initORM({
    adapter,
    debug: options?.debug ?? true,
    logLevel: options?.logLevel ?? LogLevel.DEBUG
  });
}
