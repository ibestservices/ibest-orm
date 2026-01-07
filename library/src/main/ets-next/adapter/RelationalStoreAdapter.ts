/**
 * RelationalStore 适配器
 * 用于真机/模拟器的 SQLite 数据库操作
 */

import { relationalStore } from '@kit.ArkData';
import { Context } from '@kit.AbilityKit';
import { BaseAdapter, ResultSet } from './BaseAdapter';
import { ValueType, ValuesBucket } from '../types';

/**
 * RelationalStore 配置
 */
export interface StoreConfig {
  name: string;
  securityLevel?: relationalStore.SecurityLevel;
}

/**
 * 包装 relationalStore.ResultSet
 */
class RdbResultSet implements ResultSet {
  private resultSet: relationalStore.ResultSet;

  constructor(resultSet: relationalStore.ResultSet) {
    this.resultSet = resultSet;
  }

  get rowCount(): number {
    return this.resultSet.rowCount;
  }

  get columnNames(): string[] {
    return this.resultSet.columnNames;
  }

  get isEnded(): boolean {
    return this.resultSet.isEnded;
  }

  goToFirstRow(): boolean {
    return this.resultSet.goToFirstRow();
  }

  goToNextRow(): boolean {
    return this.resultSet.goToNextRow();
  }

  goToLastRow(): boolean {
    return this.resultSet.goToLastRow();
  }

  getValue(columnIndex: number): ValueType {
    return this.resultSet.getValue(columnIndex) as ValueType;
  }

  getColumnIndex(columnName: string): number {
    return this.resultSet.getColumnIndex(columnName);
  }

  close(): void {
    this.resultSet.close();
  }
}

/**
 * RelationalStore 适配器
 */
export class RelationalStoreAdapter extends BaseAdapter {
  private store: relationalStore.RdbStore | null = null;
  private config: StoreConfig;
  private context: Context;

  constructor(context: Context, config: StoreConfig) {
    super();
    this.context = context;
    this.config = config;
  }

  /**
   * 初始化数据库连接
   */
  async init(): Promise<void> {
    const storeConfig: relationalStore.StoreConfig = {
      name: this.config.name,
      securityLevel: this.config.securityLevel || relationalStore.SecurityLevel.S1
    };

    this.store = await relationalStore.getRdbStore(this.context, storeConfig);
    this.connected = true;
  }

  /**
   * 获取原始 RdbStore
   */
  getRdbStore(): relationalStore.RdbStore | null {
    return this.store;
  }

  async executeSql(sql: string, params?: ValueType[]): Promise<void> {
    if (!this.store) throw new Error('Database not initialized');
    await this.store.executeSql(sql, params);
  }

  executeSqlSync(sql: string, params?: ValueType[]): void {
    if (!this.store) throw new Error('Database not initialized');
    this.store.executeSync(sql, params as relationalStore.ValueType[]);
  }

  query(sql: string, params?: ValueType[]): ResultSet {
    if (!this.store) throw new Error('Database not initialized');
    const resultSet = this.store.querySqlSync(sql, params as relationalStore.ValueType[]);
    return new RdbResultSet(resultSet);
  }

  insert(table: string, values: ValuesBucket): number {
    if (!this.store) throw new Error('Database not initialized');
    const bucket = values as relationalStore.ValuesBucket;
    return Number(this.store.insertSync(table, bucket));
  }

  batchInsert(table: string, values: ValuesBucket[]): number {
    if (!this.store) throw new Error('Database not initialized');
    let count = 0;
    for (const v of values) {
      const bucket = v as relationalStore.ValuesBucket;
      if (this.store.insertSync(table, bucket) > 0) count++;
    }
    return count;
  }

  update(table: string, values: ValuesBucket, whereClause: string, whereArgs: ValueType[]): number {
    if (!this.store) throw new Error('Database not initialized');

    // 构建 UPDATE SQL
    const setClauses = Object.keys(values).map(k => `${k} = ?`).join(', ');
    const setValues = Object.values(values) as ValueType[];
    const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClause}`;
    const params = [...setValues, ...whereArgs];

    this.store.executeSync(sql, params as relationalStore.ValueType[]);
    return 1;
  }

  delete(table: string, whereClause: string, whereArgs: ValueType[]): number {
    if (!this.store) throw new Error('Database not initialized');

    const predicates = new relationalStore.RdbPredicates(table);
    this.applyWhereClause(predicates, whereClause, whereArgs);

    return this.store.deleteSync(predicates);
  }

  beginTransaction(): void {
    if (!this.store) throw new Error('Database not initialized');
    this.store.beginTransaction();
  }

  commit(): void {
    if (!this.store) throw new Error('Database not initialized');
    this.store.commit();
  }

  rollback(): void {
    if (!this.store) throw new Error('Database not initialized');
    this.store.rollBack();
  }

  async close(): Promise<void> {
    if (this.store) {
      this.store = null;
      this.connected = false;
    }
  }

  /**
   * 解析 WHERE 子句并应用到 RdbPredicates
   * 支持多条件 AND 连接
   */
  private applyWhereClause(predicates: relationalStore.RdbPredicates, whereClause: string, whereArgs: ValueType[]): void {
    if (!whereClause) return;

    let paramIndex = 0;
    // 按 AND 分割条件
    const conditions = whereClause.split(/\s+AND\s+/i);

    for (const cond of conditions) {
      const trimmed = cond.trim();

      // IS NULL
      const isNullMatch = trimmed.match(/(\w+)\s+IS\s+NULL/i);
      if (isNullMatch) {
        predicates.isNull(isNullMatch[1]);
        continue;
      }

      // IS NOT NULL
      const isNotNullMatch = trimmed.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
      if (isNotNullMatch) {
        predicates.isNotNull(isNotNullMatch[1]);
        continue;
      }

      // field IN (?, ?, ...)
      const inMatch = trimmed.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const field = inMatch[1];
        const placeholderCount = inMatch[2].split(',').length;
        const values = whereArgs.slice(paramIndex, paramIndex + placeholderCount);
        predicates.in(field, values as relationalStore.ValueType[]);
        paramIndex += placeholderCount;
        continue;
      }

      // field >= ?
      const gteMatch = trimmed.match(/(\w+)\s*>=\s*\?/);
      if (gteMatch) {
        predicates.greaterThanOrEqualTo(gteMatch[1], whereArgs[paramIndex] as relationalStore.ValueType);
        paramIndex++;
        continue;
      }

      // field > ?
      const gtMatch = trimmed.match(/(\w+)\s*>\s*\?/);
      if (gtMatch) {
        predicates.greaterThan(gtMatch[1], whereArgs[paramIndex] as relationalStore.ValueType);
        paramIndex++;
        continue;
      }

      // field <= ?
      const lteMatch = trimmed.match(/(\w+)\s*<=\s*\?/);
      if (lteMatch) {
        predicates.lessThanOrEqualTo(lteMatch[1], whereArgs[paramIndex] as relationalStore.ValueType);
        paramIndex++;
        continue;
      }

      // field < ?
      const ltMatch = trimmed.match(/(\w+)\s*<\s*\?/);
      if (ltMatch) {
        predicates.lessThan(ltMatch[1], whereArgs[paramIndex] as relationalStore.ValueType);
        paramIndex++;
        continue;
      }

      // field != ?
      const neMatch = trimmed.match(/(\w+)\s*!=\s*\?/);
      if (neMatch) {
        predicates.notEqualTo(neMatch[1], whereArgs[paramIndex] as relationalStore.ValueType);
        paramIndex++;
        continue;
      }

      // field LIKE ?
      const likeMatch = trimmed.match(/(\w+)\s+LIKE\s+\?/i);
      if (likeMatch) {
        predicates.like(likeMatch[1], whereArgs[paramIndex] as string);
        paramIndex++;
        continue;
      }

      // field = ?
      const eqMatch = trimmed.match(/(\w+)\s*=\s*\?/);
      if (eqMatch) {
        predicates.equalTo(eqMatch[1], whereArgs[paramIndex] as relationalStore.ValueType);
        paramIndex++;
        continue;
      }
    }
  }
}

/**
 * 创建并初始化适配器
 */
export async function createRelationalStoreAdapter(context: Context, config: StoreConfig): Promise<RelationalStoreAdapter> {
  const adapter = new RelationalStoreAdapter(context, config);
  await adapter.init();
  return adapter;
}
