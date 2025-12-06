/**
 * 内存数据库适配器（用于预览器和测试）
 */

import { BaseAdapter, ResultSet } from './BaseAdapter';
import { ValueType, ValuesBucket } from '../types';

/**
 * 内存结果集
 */
class MemoryResultSet implements ResultSet {
  private data: ValuesBucket[];
  private currentIndex: number = -1;

  constructor(data: ValuesBucket[]) {
    this.data = data;
  }

  get rowCount(): number {
    return this.data.length;
  }

  get columnNames(): string[] {
    if (this.data.length === 0) return [];
    return Object.keys(this.data[0]);
  }

  get isEnded(): boolean {
    return this.currentIndex >= this.data.length;
  }

  goToFirstRow(): boolean {
    if (this.data.length === 0) return false;
    this.currentIndex = 0;
    return true;
  }

  goToNextRow(): boolean {
    this.currentIndex++;
    return this.currentIndex < this.data.length;
  }

  goToLastRow(): boolean {
    if (this.data.length === 0) return false;
    this.currentIndex = this.data.length - 1;
    return true;
  }

  getValue(columnIndex: number): ValueType {
    if (this.currentIndex < 0 || this.currentIndex >= this.data.length) {
      return null;
    }
    const row = this.data[this.currentIndex];
    const key = this.columnNames[columnIndex];
    return row[key] ?? null;
  }

  getColumnIndex(columnName: string): number {
    return this.columnNames.indexOf(columnName);
  }

  close(): void {
    this.data = [];
    this.currentIndex = -1;
  }
}

/**
 * 表结构
 */
interface TableSchema {
  columns: Map<string, { type: string; primaryKey: boolean; autoIncrement: boolean; notNull: boolean }>;
  data: ValuesBucket[];
  autoIncrementId: number;
}

/**
 * 内存数据库适配器
 */
export class MemoryAdapter extends BaseAdapter {
  private tables: Map<string, TableSchema> = new Map();
  private inTransaction: boolean = false;
  private transactionBackup: Map<string, TableSchema> | null = null;

  constructor() {
    super();
    this.connected = true;
  }

  async executeSql(sql: string, params?: ValueType[]): Promise<void> {
    this.executeSqlSync(sql, params);
  }

  executeSqlSync(sql: string, params?: ValueType[]): void {
    const trimmedSql = sql.trim().toUpperCase();

    if (trimmedSql.startsWith('CREATE TABLE')) {
      this.parseCreateTable(sql);
    } else if (trimmedSql.startsWith('DROP TABLE')) {
      this.parseDropTable(sql);
    } else if (trimmedSql.startsWith('ALTER TABLE')) {
      this.parseAlterTable(sql);
    }
  }

  private parseCreateTable(sql: string): void {
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)\s*\((.+)\)/i);
    if (!match) return;

    const tableName = match[1].toLowerCase();
    const columnsDef = match[2];

    if (this.tables.has(tableName)) return;

    const schema: TableSchema = {
      columns: new Map(),
      data: [],
      autoIncrementId: 0
    };

    const columnParts = columnsDef.split(',').map(s => s.trim());
    for (const part of columnParts) {
      const tokens = part.split(/\s+/);
      const colName = tokens[0].toLowerCase();
      const colType = tokens[1]?.toUpperCase() || 'TEXT';

      schema.columns.set(colName, {
        type: colType,
        primaryKey: part.toUpperCase().includes('PRIMARY KEY'),
        autoIncrement: part.toUpperCase().includes('AUTOINCREMENT'),
        notNull: part.toUpperCase().includes('NOT NULL')
      });
    }

    this.tables.set(tableName, schema);
  }

  private parseDropTable(sql: string): void {
    const match = sql.match(/DROP TABLE IF EXISTS (\w+)/i);
    if (match) {
      this.tables.delete(match[1].toLowerCase());
    }
  }

  private parseAlterTable(sql: string): void {
    const addMatch = sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
    if (addMatch) {
      const table = this.tables.get(addMatch[1].toLowerCase());
      if (table) {
        table.columns.set(addMatch[2].toLowerCase(), {
          type: 'TEXT',
          primaryKey: false,
          autoIncrement: false,
          notNull: false
        });
      }
    }

    const dropMatch = sql.match(/ALTER TABLE (\w+) DROP COLUMN (\w+)/i);
    if (dropMatch) {
      const table = this.tables.get(dropMatch[1].toLowerCase());
      if (table) {
        table.columns.delete(dropMatch[2].toLowerCase());
      }
    }
  }

  query(sql: string, params?: ValueType[]): ResultSet {
    const selectMatch = sql.match(/SELECT .+ FROM (\w+)/i);
    if (!selectMatch) {
      return new MemoryResultSet([]);
    }

    const tableName = selectMatch[1].toLowerCase();
    const table = this.tables.get(tableName);
    if (!table) {
      return new MemoryResultSet([]);
    }

    let results = [...table.data];

    // WHERE 解析
    const whereMatch = sql.match(/WHERE (.+?)(?:ORDER|LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      results = results.filter(row => this.matchWhere(row, whereClause, params || []));
    }

    // ORDER BY
    const orderMatch = sql.match(/ORDER BY (\w+)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      const field = orderMatch[1].toLowerCase();
      const desc = orderMatch[2]?.toUpperCase() === 'DESC';
      results.sort((a, b) => {
        const va = a[field];
        const vb = b[field];
        if (va === vb) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        const cmp = va < vb ? -1 : 1;
        return desc ? -cmp : cmp;
      });
    }

    // LIMIT
    const limitMatch = sql.match(/LIMIT (\d+)/i);
    if (limitMatch) {
      results = results.slice(0, parseInt(limitMatch[1]));
    }

    return new MemoryResultSet(results);
  }

  insert(tableName: string, values: ValuesBucket): number {
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) return -1;

    // 将 values 的 key 转为小写映射
    const lowerValues: ValuesBucket = {};
    for (const [k, v] of Object.entries(values)) {
      lowerValues[k.toLowerCase()] = v;
    }

    const row: ValuesBucket = {};

    for (const [colName, colDef] of table.columns) {
      if (colDef.autoIncrement && colDef.primaryKey) {
        table.autoIncrementId++;
        row[colName] = table.autoIncrementId;
      } else {
        row[colName] = lowerValues[colName] ?? null;
      }
    }

    table.data.push(row);

    // 返回自增 ID
    for (const [colName, colDef] of table.columns) {
      if (colDef.autoIncrement && colDef.primaryKey) {
        return row[colName] as number;
      }
    }

    return table.data.length;
  }

  batchInsert(tableName: string, values: ValuesBucket[]): number {
    let count = 0;
    for (const v of values) {
      if (this.insert(tableName, v) > 0) count++;
    }
    return count;
  }

  update(tableName: string, values: ValuesBucket, whereClause: string, whereArgs: ValueType[]): number {
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) return 0;

    let count = 0;

    for (const row of table.data) {
      if (this.matchWhere(row, whereClause, whereArgs)) {
        for (const [key, val] of Object.entries(values)) {
          row[key.toLowerCase()] = val;
        }
        count++;
      }
    }

    return count;
  }

  private matchWhere(row: ValuesBucket, whereClause: string, whereArgs: ValueType[]): boolean {
    if (!whereClause) return true;

    let paramIndex = 0;
    const conditions = whereClause.split(/\s+AND\s+/i);

    for (const cond of conditions) {
      const trimmed = cond.trim();

      // IS NULL
      const isNullMatch = trimmed.match(/(\w+)\s+IS\s+NULL/i);
      if (isNullMatch) {
        const field = isNullMatch[1].toLowerCase();
        if (row[field] !== null && row[field] !== undefined) return false;
        continue;
      }

      // IS NOT NULL
      const isNotNullMatch = trimmed.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
      if (isNotNullMatch) {
        const field = isNotNullMatch[1].toLowerCase();
        if (row[field] === null || row[field] === undefined) return false;
        continue;
      }

      // field IN (?, ?, ...)
      const inMatch = trimmed.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const field = inMatch[1].toLowerCase();
        const placeholderCount = inMatch[2].split(',').length;
        const values = whereArgs.slice(paramIndex, paramIndex + placeholderCount);
        if (!values.includes(row[field])) return false;
        paramIndex += placeholderCount;
        continue;
      }

      // field >= ?
      const gteMatch = trimmed.match(/(\w+)\s*>=\s*\?/);
      if (gteMatch) {
        const field = gteMatch[1].toLowerCase();
        if ((row[field] as number) < (whereArgs[paramIndex] as number)) return false;
        paramIndex++;
        continue;
      }

      // field > ?
      const gtMatch = trimmed.match(/(\w+)\s*>\s*\?/);
      if (gtMatch) {
        const field = gtMatch[1].toLowerCase();
        if ((row[field] as number) <= (whereArgs[paramIndex] as number)) return false;
        paramIndex++;
        continue;
      }

      // field <= ?
      const lteMatch = trimmed.match(/(\w+)\s*<=\s*\?/);
      if (lteMatch) {
        const field = lteMatch[1].toLowerCase();
        if ((row[field] as number) > (whereArgs[paramIndex] as number)) return false;
        paramIndex++;
        continue;
      }

      // field < ?
      const ltMatch = trimmed.match(/(\w+)\s*<\s*\?/);
      if (ltMatch) {
        const field = ltMatch[1].toLowerCase();
        if ((row[field] as number) >= (whereArgs[paramIndex] as number)) return false;
        paramIndex++;
        continue;
      }

      // field = ?
      const eqMatch = trimmed.match(/(\w+)\s*=\s*\?/);
      if (eqMatch) {
        const field = eqMatch[1].toLowerCase();
        if (row[field] !== whereArgs[paramIndex]) return false;
        paramIndex++;
        continue;
      }
    }

    return true;
  }

  delete(tableName: string, whereClause: string, whereArgs: ValueType[]): number {
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) return 0;

    const originalLength = table.data.length;
    table.data = table.data.filter(row => !this.matchWhere(row, whereClause, whereArgs));

    return originalLength - table.data.length;
  }

  beginTransaction(): void {
    this.inTransaction = true;
    this.transactionBackup = new Map();
    for (const [name, schema] of this.tables) {
      this.transactionBackup.set(name, {
        columns: new Map(schema.columns),
        data: schema.data.map(row => ({ ...row })),
        autoIncrementId: schema.autoIncrementId
      });
    }
  }

  commit(): void {
    this.inTransaction = false;
    this.transactionBackup = null;
  }

  rollback(): void {
    if (this.transactionBackup) {
      this.tables = this.transactionBackup;
    }
    this.inTransaction = false;
    this.transactionBackup = null;
  }

  async close(): Promise<void> {
    this.tables.clear();
    this.connected = false;
  }

  /**
   * 获取表数据（测试用）
   */
  getTableData(tableName: string): ValuesBucket[] {
    return this.tables.get(tableName.toLowerCase())?.data || [];
  }

  /**
   * 清空所有数据（测试用）
   */
  clear(): void {
    this.tables.clear();
  }
}
