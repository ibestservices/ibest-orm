/**
 * 查询构建器
 */

import { Class, ValueType, ValuesBucket, OrderDirection, WhereCondition, ConditionValue, RelationType } from '../types';
import { metadataStorage, EntityMetadata, ColumnMetadata, RelationMetadata } from '../types/metadata';
import { DatabaseAdapter, ResultSet } from '../adapter/BaseAdapter';
import { QueryError, ErrorCode, ORMError } from '../error';
import { getLogger } from '../logger';
import { classToTable, getLocalTimeString, isPlainObject, snakeToCamel } from '../utils';
import { enableLazyLoading } from '../relation/LazyLoader';

/**
 * 条件项
 */
interface ConditionItem {
  type: 'and' | 'or';
  field: string;
  operator: string;
  value: ValueType | ValueType[];
}

/**
 * 查询构建器
 */
export class QueryBuilder<T = unknown> {
  private adapter: DatabaseAdapter;
  private entityClass?: Class<T>;
  private tableName: string = '';
  private metadata?: EntityMetadata;

  private selectColumns: string[] = [];
  private conditions: ConditionItem[] = [];
  private orderByList: Array<{ field: string; direction: OrderDirection }> = [];
  private limitValue?: number;
  private offsetValue?: number;
  private groupByFields: string[] = [];
  private preloadRelations: string[] = [];
  private includeTrashed: boolean = false;
  private enableLazy: boolean = false;

  private nextConditionType: 'and' | 'or' = 'and';

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * 设置实体类
   */
  from(entityClass: Class<T>): this {
    this.entityClass = entityClass;
    this.metadata = metadataStorage.getEntityMetadata(entityClass);
    this.tableName = this.metadata?.table.name || classToTable(entityClass.name);
    return this;
  }

  /**
   * 设置表名
   */
  table(name: string): this {
    this.tableName = name;
    return this;
  }

  /**
   * 选择字段
   */
  select(...columns: (keyof T | string)[]): this {
    this.selectColumns = columns as string[];
    return this;
  }

  /**
   * 条件查询 - 对象风格
   */
  where(conditions: WhereCondition<T>): this;
  /**
   * 条件查询 - 键值对风格
   */
  where(field: keyof T | string, value: ValueType | ValueType[]): this;
  where(fieldOrConditions: keyof T | string | WhereCondition<T>, value?: ValueType | ValueType[]): this {
    if (isPlainObject(fieldOrConditions)) {
      this.parseObjectConditions(fieldOrConditions as WhereCondition<T>);
    } else {
      this.addCondition(fieldOrConditions as string, '=', value!);
    }
    return this;
  }

  /**
   * 不等于
   */
  whereNot(field: keyof T | string, value: ValueType): this {
    this.addCondition(field as string, '!=', value);
    return this;
  }

  /**
   * IN 查询
   */
  whereIn(field: keyof T | string, values: ValueType[]): this {
    this.addCondition(field as string, 'IN', values);
    return this;
  }

  /**
   * NOT IN 查询
   */
  whereNotIn(field: keyof T | string, values: ValueType[]): this {
    this.addCondition(field as string, 'NOT IN', values);
    return this;
  }

  /**
   * NULL 查询
   */
  whereNull(field: keyof T | string): this {
    this.addCondition(field as string, 'IS NULL', null);
    return this;
  }

  /**
   * NOT NULL 查询
   */
  whereNotNull(field: keyof T | string): this {
    this.addCondition(field as string, 'IS NOT NULL', null);
    return this;
  }

  /**
   * BETWEEN 查询
   */
  whereBetween(field: keyof T | string, min: ValueType, max: ValueType): this {
    this.addCondition(field as string, 'BETWEEN', [min, max]);
    return this;
  }

  /**
   * LIKE 查询
   */
  whereLike(field: keyof T | string, pattern: string): this {
    this.addCondition(field as string, 'LIKE', pattern);
    return this;
  }

  /**
   * 大于
   */
  whereGt(field: keyof T | string, value: ValueType): this {
    this.addCondition(field as string, '>', value);
    return this;
  }

  /**
   * 大于等于
   */
  whereGte(field: keyof T | string, value: ValueType): this {
    this.addCondition(field as string, '>=', value);
    return this;
  }

  /**
   * 小于
   */
  whereLt(field: keyof T | string, value: ValueType): this {
    this.addCondition(field as string, '<', value);
    return this;
  }

  /**
   * 小于等于
   */
  whereLte(field: keyof T | string, value: ValueType): this {
    this.addCondition(field as string, '<=', value);
    return this;
  }

  /**
   * OR 连接
   */
  or(): this {
    this.nextConditionType = 'or';
    return this;
  }

  /**
   * AND 连接
   */
  and(): this {
    this.nextConditionType = 'and';
    return this;
  }

  /**
   * 排序
   */
  orderBy(field: keyof T | string, direction: OrderDirection = 'asc'): this {
    this.orderByList.push({ field: this.toColumnName(field as string), direction });
    return this;
  }

  /**
   * 限制数量
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * 偏移量
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * 分组
   */
  groupBy(...fields: (keyof T | string)[]): this {
    this.groupByFields = fields.map(f => this.toColumnName(f as string));
    return this;
  }

  /**
   * 预加载关联
   */
  with(...relations: string[]): this {
    this.preloadRelations.push(...relations);
    return this;
  }

  /**
   * 启用延迟加载
   */
  lazy(): this {
    this.enableLazy = true;
    return this;
  }

  /**
   * 包含已软删除的记录
   */
  withTrashed(): this {
    this.includeTrashed = true;
    return this;
  }

  /**
   * 只查询已软删除的记录
   */
  onlyTrashed(): this {
    this.includeTrashed = true;
    if (this.metadata) {
      const softDeleteCol = this.metadata.columns.find(c => c.isSoftDelete);
      if (softDeleteCol) {
        this.addCondition(softDeleteCol.propertyKey, 'IS NOT NULL', null);
      }
    }
    return this;
  }

  /**
   * 查询第一条
   */
  first(): T | null {
    this.limitValue = 1;
    const results = this.find();
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 查询最后一条
   */
  last(): T | null {
    const results = this.find();
    return results.length > 0 ? results[results.length - 1] : null;
  }

  /**
   * 查询所有
   */
  find(): T[] {
    this.ensureTable();

    const { sql, params } = this.buildSelectSQL();
    const startTime = Date.now();

    try {
      const resultSet = this.adapter.query(sql, params);
      let results = this.parseResultSet(resultSet);

      getLogger().logSQL(sql, params, Date.now() - startTime);

      // 加载关联数据
      if (this.preloadRelations.length > 0 && this.metadata) {
        results = this.loadRelations(results);
      }

      return results as T[];
    } catch (error) {
      throw new QueryError({
        message: `查询失败: ${(error as Error).message}`,
        table: this.tableName,
        sql,
        cause: error as Error
      });
    }
  }

  /**
   * 计数
   */
  count(): number {
    this.ensureTable();

    const whereClause = this.buildWhereClause();
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName}${whereClause.sql}`;

    const resultSet = this.adapter.query(sql, whereClause.params);
    if (resultSet.goToFirstRow()) {
      const count = resultSet.getValue(0);
      resultSet.close();
      return typeof count === 'number' ? count : 0;
    }
    resultSet.close();
    return 0;
  }

  /**
   * 是否存在
   */
  exists(): boolean {
    return this.count() > 0;
  }

  /**
   * 插入
   */
  insert(data: Partial<T> | Partial<T>[]): number {
    this.ensureTable();

    if (Array.isArray(data)) {
      const values = data.map(d => this.toValuesBucket(d));
      return this.adapter.batchInsert(this.tableName, values);
    }

    const values = this.toValuesBucket(data);
    return this.adapter.insert(this.tableName, values);
  }

  /**
   * 更新
   */
  update(data: Partial<T>): number {
    this.ensureTable();

    const values = this.toValuesBucket(data);

    // 自动更新时间
    if (this.metadata) {
      const updateAtCol = this.metadata.columns.find(c => c.isAutoUpdateTime);
      if (updateAtCol) {
        values[updateAtCol.name] = getLocalTimeString();
      }
    }

    const whereClause = this.buildWhereClause();
    return this.adapter.update(this.tableName, values, whereClause.sql.replace(' WHERE ', ''), whereClause.params);
  }

  /**
   * 删除（硬删除）
   */
  delete(): number {
    this.ensureTable();

    const whereClause = this.buildWhereClause();
    return this.adapter.delete(this.tableName, whereClause.sql.replace(' WHERE ', ''), whereClause.params);
  }

  /**
   * 软删除
   */
  softDelete(): number {
    this.ensureTable();

    if (!this.metadata) {
      throw new ORMError({
        code: ErrorCode.SOFT_DELETE_NOT_CONFIGURED,
        table: this.tableName,
        suggestion: '软删除需要实体定义 @SoftDelete 装饰器'
      });
    }

    const softDeleteCol = this.metadata.columns.find(c => c.isSoftDelete);
    if (!softDeleteCol) {
      throw new ORMError({
        code: ErrorCode.SOFT_DELETE_NOT_CONFIGURED,
        table: this.tableName,
        suggestion: '软删除需要实体定义 @SoftDelete 装饰器'
      });
    }

    const values: ValuesBucket = { [softDeleteCol.name]: getLocalTimeString() };
    const whereClause = this.buildWhereClause();
    return this.adapter.update(this.tableName, values, whereClause.sql.replace(' WHERE ', ''), whereClause.params);
  }

  /**
   * 恢复软删除的记录
   */
  restore(): number {
    this.ensureTable();

    if (!this.metadata) return 0;

    const softDeleteCol = this.metadata.columns.find(c => c.isSoftDelete);
    if (!softDeleteCol) return 0;

    const values: ValuesBucket = { [softDeleteCol.name]: null };
    const whereClause = this.buildWhereClause();
    return this.adapter.update(this.tableName, values, whereClause.sql.replace(' WHERE ', ''), whereClause.params);
  }

  /**
   * 强制物理删除（忽略软删除配置）
   */
  forceDelete(): number {
    this.ensureTable();

    // 临时包含已删除记录，确保能删除软删除的数据
    this.includeTrashed = true;
    const whereClause = this.buildWhereClause();
    return this.adapter.delete(this.tableName, whereClause.sql.replace(' WHERE ', ''), whereClause.params);
  }

  /**
   * 重置查询条件
   */
  reset(): this {
    this.selectColumns = [];
    this.conditions = [];
    this.orderByList = [];
    this.limitValue = undefined;
    this.offsetValue = undefined;
    this.groupByFields = [];
    this.preloadRelations = [];
    this.includeTrashed = false;
    this.nextConditionType = 'and';
    return this;
  }

  // ========== 私有方法 ==========

  private ensureTable(): void {
    if (!this.tableName) {
      throw new ORMError({
        code: ErrorCode.TABLE_NOT_SET,
        suggestion: '请先调用 from() 或 table() 方法设置表名'
      });
    }
  }

  private addCondition(field: string, operator: string, value: ValueType | ValueType[]): void {
    this.conditions.push({
      type: this.nextConditionType,
      field: this.toColumnName(field),
      operator,
      value
    });
    this.nextConditionType = 'and';
  }

  private parseObjectConditions(conditions: WhereCondition<T>): void {
    for (const [field, condition] of Object.entries(conditions)) {
      if (condition === undefined) continue;

      if (isPlainObject(condition)) {
        const cond = condition as Record<string, unknown>;
        if ('eq' in cond) this.addCondition(field, '=', cond['eq'] as ValueType);
        else if ('ne' in cond) this.addCondition(field, '!=', cond['ne'] as ValueType);
        else if ('gt' in cond) this.addCondition(field, '>', cond['gt'] as ValueType);
        else if ('gte' in cond) this.addCondition(field, '>=', cond['gte'] as ValueType);
        else if ('lt' in cond) this.addCondition(field, '<', cond['lt'] as ValueType);
        else if ('lte' in cond) this.addCondition(field, '<=', cond['lte'] as ValueType);
        else if ('like' in cond) this.addCondition(field, 'LIKE', cond['like'] as string);
        else if ('in' in cond) this.addCondition(field, 'IN', cond['in'] as ValueType[]);
        else if ('notIn' in cond) this.addCondition(field, 'NOT IN', cond['notIn'] as ValueType[]);
        else if ('between' in cond) this.addCondition(field, 'BETWEEN', cond['between'] as ValueType[]);
        else if ('isNull' in cond) {
          if (cond['isNull']) this.addCondition(field, 'IS NULL', null);
          else this.addCondition(field, 'IS NOT NULL', null);
        }
      } else {
        this.addCondition(field, '=', condition as ValueType);
      }
    }
  }

  private toColumnName(propertyKey: string): string {
    if (!this.metadata) return propertyKey;

    const column = this.metadata.columns.find(c => c.propertyKey === propertyKey);
    return column?.name || propertyKey;
  }

  private toPropertyKey(columnName: string): string {
    if (!this.metadata) return columnName;

    const column = this.metadata.columns.find(c => c.name === columnName);
    return column?.propertyKey || columnName;
  }

  private toValuesBucket(data: Partial<T>): ValuesBucket {
    const bucket: ValuesBucket = {};

    for (const [key, value] of Object.entries(data as object)) {
      const columnName = this.toColumnName(key);
      bucket[columnName] = value as ValueType;
    }

    return bucket;
  }

  private buildSelectSQL(): { sql: string; params: ValueType[] } {
    const columns = this.selectColumns.length > 0
      ? this.selectColumns.map(c => this.toColumnName(c)).join(', ')
      : '*';

    let sql = `SELECT ${columns} FROM ${this.tableName}`;

    const whereClause = this.buildWhereClause();
    sql += whereClause.sql;

    if (this.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }

    if (this.orderByList.length > 0) {
      const orderParts = this.orderByList.map(o => `${o.field} ${o.direction.toUpperCase()}`);
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params: whereClause.params };
  }

  private buildWhereClause(): { sql: string; params: ValueType[] } {
    const parts: string[] = [];
    const params: ValueType[] = [];

    // 自动添加软删除过滤条件
    if (!this.includeTrashed && this.metadata) {
      const softDeleteCol = this.metadata.columns.find(c => c.isSoftDelete);
      if (softDeleteCol) {
        parts.push(`${softDeleteCol.name} IS NULL`);
      }
    }

    if (this.conditions.length === 0 && parts.length === 0) {
      return { sql: '', params: [] };
    }

    for (let i = 0; i < this.conditions.length; i++) {
      const cond = this.conditions[i];
      let clause = '';

      if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
        clause = `${cond.field} ${cond.operator}`;
      } else if (cond.operator === 'IN' || cond.operator === 'NOT IN') {
        const values = cond.value as ValueType[];
        const placeholders = values.map(() => '?').join(', ');
        clause = `${cond.field} ${cond.operator} (${placeholders})`;
        params.push(...values);
      } else if (cond.operator === 'BETWEEN') {
        const [min, max] = cond.value as ValueType[];
        clause = `${cond.field} BETWEEN ? AND ?`;
        params.push(min, max);
      } else {
        clause = `${cond.field} ${cond.operator} ?`;
        params.push(cond.value as ValueType);
      }

      // 如果 parts 已有软删除条件或之前的条件，用 AND 连接
      if (parts.length === 0) {
        parts.push(clause);
      } else {
        parts.push(`${cond.type.toUpperCase()} ${clause}`);
      }
    }

    return { sql: ` WHERE ${parts.join(' ')}`, params };
  }

  private parseResultSet(resultSet: ResultSet): T[] {
    const results: T[] = [];

    if (resultSet.rowCount > 0 && resultSet.goToFirstRow()) {
      while (!resultSet.isEnded) {
        const row: Record<string, unknown> = {};

        for (let i = 0; i < resultSet.columnNames.length; i++) {
          const columnName = resultSet.columnNames[i];
          const propertyKey = this.toPropertyKey(columnName);
          row[propertyKey] = resultSet.getValue(i);
        }

        // 设置原型链，确保 constructor 指向正确的类
        if (this.entityClass) {
          Object.setPrototypeOf(row, this.entityClass.prototype);
        }

        // 启用延迟加载
        if (this.enableLazy && this.metadata) {
          enableLazyLoading(row, this.adapter, this.metadata);
        }

        results.push(row as T);
        resultSet.goToNextRow();
      }
    }

    resultSet.close();
    return results;
  }

  /**
   * 加载关联数据
   */
  private loadRelations(results: T[]): T[] {
    if (results.length === 0 || !this.metadata) return results;

    for (const relationPath of this.preloadRelations) {
      this.loadRelationPath(results, relationPath, this.metadata);
    }

    return results;
  }

  /**
   * 加载关联路径（支持嵌套如 'author.books'）
   */
  private loadRelationPath(
    results: unknown[],
    path: string,
    meta: EntityMetadata
  ): void {
    const parts = path.split('.');
    const relationName = parts[0];
    const nestedPath = parts.slice(1).join('.');

    const relation = meta.relations.find(r => r.propertyKey === relationName);
    if (!relation) return;

    this.loadSingleRelation(results as T[], relation);

    // 处理嵌套关联
    if (nestedPath) {
      const targetClass = typeof relation.target === 'function' && relation.target.prototype
        ? relation.target as Class
        : (relation.target as () => Class)();
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) return;

      // 收集所有关联数据
      const relatedData: unknown[] = [];
      for (const row of results) {
        const related = (row as Record<string, unknown>)[relationName];
        if (Array.isArray(related)) {
          relatedData.push(...related);
        } else if (related) {
          relatedData.push(related);
        }
      }

      if (relatedData.length > 0) {
        this.loadRelationPath(relatedData, nestedPath, targetMeta);
      }
    }
  }

  /**
   * 加载单个关联
   */
  private loadSingleRelation(results: T[], relation: RelationMetadata): void {
    const targetClass = typeof relation.target === 'function' && relation.target.prototype
      ? relation.target as Class
      : (relation.target as () => Class)();

    const targetMeta = metadataStorage.getEntityMetadata(targetClass);
    if (!targetMeta) return;

    const targetTable = targetMeta.table.name;
    const localKey = relation.localKey || 'id';
    const foreignKey = relation.foreignKey || this.inferForeignKey(relation, targetTable);

    // 收集主表的键值
    const keyValues: ValueType[] = [];
    for (const row of results) {
      const keyField = relation.type === RelationType.BelongsTo ? foreignKey : localKey;
      const val = (row as Record<string, unknown>)[keyField] as ValueType;
      if (val !== undefined && val !== null && !keyValues.includes(val)) {
        keyValues.push(val);
      }
    }

    if (keyValues.length === 0) return;

    let relationData: Record<string, unknown>[] = [];

    if (relation.type === RelationType.ManyToMany) {
      relationData = this.loadManyToManyRelation(relation, keyValues, targetTable);
    } else {
      const queryKey = relation.type === RelationType.BelongsTo ? localKey : foreignKey;
      relationData = this.queryRelationData(targetTable, queryKey, keyValues, targetClass);
    }

    // 构建映射并附加到结果
    this.attachRelationData(results, relationData, relation, localKey, foreignKey, targetMeta);
  }

  /**
   * 查询关联数据
   */
  private queryRelationData(
    table: string,
    keyField: string,
    keyValues: ValueType[],
    targetClass: Class
  ): Record<string, unknown>[] {
    const placeholders = keyValues.map(() => '?').join(', ');
    const sql = `SELECT * FROM ${table} WHERE ${keyField} IN (${placeholders})`;

    const resultSet = this.adapter.query(sql, keyValues);
    const data: Record<string, unknown>[] = [];
    const targetMeta = metadataStorage.getEntityMetadata(targetClass);

    if (resultSet.rowCount > 0 && resultSet.goToFirstRow()) {
      while (!resultSet.isEnded) {
        const row: Record<string, unknown> = {};
        for (let i = 0; i < resultSet.columnNames.length; i++) {
          const colName = resultSet.columnNames[i];
          const propKey = targetMeta?.columns.find(c => c.name === colName)?.propertyKey || colName;
          row[propKey] = resultSet.getValue(i);
        }
        Object.setPrototypeOf(row, targetClass.prototype);
        data.push(row);
        resultSet.goToNextRow();
      }
    }
    resultSet.close();
    return data;
  }

  /**
   * 加载多对多关联
   */
  private loadManyToManyRelation(
    relation: RelationMetadata,
    keyValues: ValueType[],
    targetTable: string
  ): Record<string, unknown>[] {
    if (!relation.through) return [];

    const throughTable = typeof relation.through === 'string'
      ? relation.through
      : classToTable((relation.through as Class).name);

    const throughFk = relation.throughForeignKey || `${this.tableName.replace(/s$/, '')}_id`;
    const throughOk = relation.throughOtherKey || `${targetTable.replace(/s$/, '')}_id`;

    const placeholders = keyValues.map(() => '?').join(', ');
    const sql = `SELECT t.*, m.${throughFk} as __fk__ FROM ${targetTable} t
      INNER JOIN ${throughTable} m ON t.id = m.${throughOk}
      WHERE m.${throughFk} IN (${placeholders})`;

    const resultSet = this.adapter.query(sql, keyValues);
    const data: Record<string, unknown>[] = [];

    const targetClass = typeof relation.target === 'function' && relation.target.prototype
      ? relation.target as Class
      : (relation.target as () => Class)();
    const targetMeta = metadataStorage.getEntityMetadata(targetClass);

    if (resultSet.rowCount > 0 && resultSet.goToFirstRow()) {
      while (!resultSet.isEnded) {
        const row: Record<string, unknown> = {};
        for (let i = 0; i < resultSet.columnNames.length; i++) {
          const colName = resultSet.columnNames[i];
          const propKey = targetMeta?.columns.find(c => c.name === colName)?.propertyKey || colName;
          row[propKey] = resultSet.getValue(i);
        }
        Object.setPrototypeOf(row, targetClass.prototype);
        data.push(row);
        resultSet.goToNextRow();
      }
    }
    resultSet.close();
    return data;
  }

  /**
   * 将关联数据附加到主结果
   */
  private attachRelationData(
    results: T[],
    relationData: Record<string, unknown>[],
    relation: RelationMetadata,
    localKey: string,
    foreignKey: string,
    targetMeta: EntityMetadata
  ): void {
    const isMany = relation.type === RelationType.HasMany || relation.type === RelationType.ManyToMany;
    const isManyToMany = relation.type === RelationType.ManyToMany;
    const isBelongsTo = relation.type === RelationType.BelongsTo;

    // HasMany: foreignKey 是目标表的列名，需要转换为属性名
    // BelongsTo: foreignKey 是当前表的属性名，不需要转换
    const foreignKeyProp = isBelongsTo
      ? foreignKey
      : (targetMeta.columns.find(c => c.name === foreignKey)?.propertyKey || foreignKey);

    // 构建映射
    const dataMap = new Map<ValueType, Record<string, unknown>[]>();
    for (const item of relationData) {
      let key: ValueType;
      if (isManyToMany) {
        key = item['__fk__'] as ValueType;
        delete item['__fk__'];
      } else if (isBelongsTo) {
        key = item[localKey] as ValueType;
      } else {
        key = item[foreignKeyProp] as ValueType;
      }

      if (!dataMap.has(key)) {
        dataMap.set(key, []);
      }
      dataMap.get(key)!.push(item);
    }

    // 附加到结果
    for (const row of results) {
      const rowObj = row as Record<string, unknown>;
      const keyField = isBelongsTo ? foreignKey : localKey;
      const keyVal = rowObj[keyField] as ValueType;
      const related = dataMap.get(keyVal) || [];

      rowObj[relation.propertyKey] = isMany ? related : (related[0] || null);
    }
  }

  /**
   * 自动推断外键名
   * - HasMany/HasOne: {currentTable}_id (数据库列名)
   * - BelongsTo: {targetTable}Id (属性名)
   */
  private inferForeignKey(relation: RelationMetadata, targetTable: string): string {
    if (relation.type === RelationType.BelongsTo) {
      // BelongsTo: 外键在当前表，使用属性名格式 (targetTableId)
      // 例如: Book.authorId -> Author, test_category -> testCategoryId
      return snakeToCamel(targetTable) + 'Id';
    } else {
      // HasMany/HasOne: 外键在目标表，使用列名格式 (current_table_id)
      // 例如: Author -> Book.author_id
      return this.tableName + '_id';
    }
  }
}
