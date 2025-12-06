/**
 * 数据库适配器基类
 */

import { ValueType, ValuesBucket } from '../types';

/**
 * 查询结果集接口
 */
export interface ResultSet {
  rowCount: number;
  columnNames: string[];
  goToFirstRow(): boolean;
  goToNextRow(): boolean;
  goToLastRow(): boolean;
  isEnded: boolean;
  getValue(columnIndex: number): ValueType;
  getColumnIndex(columnName: string): number;
  close(): void;
}

/**
 * 数据库适配器接口
 */
export interface DatabaseAdapter {
  /**
   * 执行 SQL 语句
   */
  executeSql(sql: string, params?: ValueType[]): Promise<void>;

  /**
   * 同步执行 SQL 语句
   */
  executeSqlSync(sql: string, params?: ValueType[]): void;

  /**
   * 查询
   */
  query(sql: string, params?: ValueType[]): ResultSet;

  /**
   * 插入
   */
  insert(table: string, values: ValuesBucket): number;

  /**
   * 批量插入
   */
  batchInsert(table: string, values: ValuesBucket[]): number;

  /**
   * 更新
   */
  update(table: string, values: ValuesBucket, whereClause: string, whereArgs: ValueType[]): number;

  /**
   * 删除
   */
  delete(table: string, whereClause: string, whereArgs: ValueType[]): number;

  /**
   * 开始事务
   */
  beginTransaction(): void;

  /**
   * 提交事务
   */
  commit(): void;

  /**
   * 回滚事务
   */
  rollback(): void;

  /**
   * 关闭连接
   */
  close(): Promise<void>;

  /**
   * 是否已连接
   */
  isConnected(): boolean;
}

/**
 * 适配器基类
 */
export abstract class BaseAdapter implements DatabaseAdapter {
  protected connected: boolean = false;

  abstract executeSql(sql: string, params?: ValueType[]): Promise<void>;
  abstract executeSqlSync(sql: string, params?: ValueType[]): void;
  abstract query(sql: string, params?: ValueType[]): ResultSet;
  abstract insert(table: string, values: ValuesBucket): number;
  abstract batchInsert(table: string, values: ValuesBucket[]): number;
  abstract update(table: string, values: ValuesBucket, whereClause: string, whereArgs: ValueType[]): number;
  abstract delete(table: string, whereClause: string, whereArgs: ValueType[]): number;
  abstract beginTransaction(): void;
  abstract commit(): void;
  abstract rollback(): void;
  abstract close(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }
}
