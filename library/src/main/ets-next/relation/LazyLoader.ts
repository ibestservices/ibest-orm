/**
 * 延迟加载器
 */

import { Class, ValueType, RelationType } from '../types';
import { metadataStorage, RelationMetadata, EntityMetadata } from '../types/metadata';
import { DatabaseAdapter } from '../adapter/BaseAdapter';
import { classToTable, snakeToCamel } from '../utils';

/**
 * 延迟加载缓存
 */
const lazyCache = new WeakMap<object, Map<string, unknown>>();

/**
 * 为实体启用延迟加载
 */
export function enableLazyLoading<T extends object>(
  entity: T,
  adapter: DatabaseAdapter,
  metadata: EntityMetadata
): T {
  const relations = metadata.relations.filter(r => r.lazy !== false);
  if (relations.length === 0) return entity;

  // 初始化缓存
  lazyCache.set(entity, new Map());

  for (const relation of relations) {
    defineLazyProperty(entity, relation, adapter, metadata);
  }

  return entity;
}

/**
 * 定义延迟加载属性
 */
function defineLazyProperty<T extends object>(
  entity: T,
  relation: RelationMetadata,
  adapter: DatabaseAdapter,
  metadata: EntityMetadata
): void {
  const propertyKey = relation.propertyKey;
  let loaded = false;
  let cachedValue: unknown = undefined;

  Object.defineProperty(entity, propertyKey, {
    get(): unknown {
      if (loaded) return cachedValue;

      // 加载关联数据
      cachedValue = loadRelation(entity, relation, adapter, metadata);
      loaded = true;
      return cachedValue;
    },
    set(value: unknown) {
      cachedValue = value;
      loaded = true;
    },
    enumerable: true,
    configurable: true
  });
}

/**
 * 加载关联数据
 */
function loadRelation<T extends object>(
  entity: T,
  relation: RelationMetadata,
  adapter: DatabaseAdapter,
  parentMeta: EntityMetadata
): unknown {
  const targetClass = typeof relation.target === 'function' && relation.target.prototype
    ? relation.target as Class
    : (relation.target as () => Class)();

  const targetMeta = metadataStorage.getEntityMetadata(targetClass);
  if (!targetMeta) return relation.type === RelationType.HasMany ? [] : null;

  const targetTable = targetMeta.table.name;
  const localKey = relation.localKey || 'id';
  const foreignKey = relation.foreignKey || inferForeignKey(relation, targetTable, parentMeta.table.name);

  const entityObj = entity as Record<string, unknown>;

  if (relation.type === RelationType.BelongsTo) {
    // BelongsTo: 外键在当前实体
    const fkValue = entityObj[foreignKey] as ValueType;
    if (!fkValue) return null;

    const sql = `SELECT * FROM ${targetTable} WHERE ${localKey} = ? LIMIT 1`;
    const result = adapter.query(sql, [fkValue]);

    if (result.goToFirstRow()) {
      const row = parseRow(result, targetMeta, targetClass);
      result.close();
      return row;
    }
    result.close();
    return null;
  } else if (relation.type === RelationType.HasMany || relation.type === RelationType.HasOne) {
    // HasMany/HasOne: 外键在目标表
    const pkValue = entityObj[localKey] as ValueType;
    if (!pkValue) return relation.type === RelationType.HasMany ? [] : null;

    const foreignKeyCol = targetMeta.columns.find(c => c.name === foreignKey)?.name || foreignKey;
    const sql = relation.type === RelationType.HasOne
      ? `SELECT * FROM ${targetTable} WHERE ${foreignKeyCol} = ? LIMIT 1`
      : `SELECT * FROM ${targetTable} WHERE ${foreignKeyCol} = ?`;

    const result = adapter.query(sql, [pkValue]);
    const rows: unknown[] = [];

    if (result.goToFirstRow()) {
      while (!result.isEnded) {
        rows.push(parseRow(result, targetMeta, targetClass));
        result.goToNextRow();
      }
    }
    result.close();

    return relation.type === RelationType.HasOne ? (rows[0] || null) : rows;
  }

  // ManyToMany 暂不支持延迟加载，返回空数组
  return [];
}

/**
 * 解析结果行
 */
function parseRow(
  result: { columnNames: string[]; getValue(index: number): ValueType },
  meta: EntityMetadata,
  targetClass: Class
): object {
  // 使用构造函数创建实例，确保与鸿蒙状态管理装饰器兼容
  let row: Record<string, unknown>;
  try {
    row = new targetClass() as Record<string, unknown>;
  } catch {
    row = Object.create(targetClass.prototype);
  }
  for (let i = 0; i < result.columnNames.length; i++) {
    const colName = result.columnNames[i];
    const propKey = meta.columns.find(c => c.name === colName)?.propertyKey || colName;
    row[propKey] = result.getValue(i);
  }
  return row;
}

/**
 * 推断外键名
 */
function inferForeignKey(relation: RelationMetadata, targetTable: string, currentTable: string): string {
  if (relation.type === RelationType.BelongsTo) {
    return snakeToCamel(targetTable) + 'Id';
  }
  return currentTable + '_id';
}

/**
 * 清除实体的延迟加载缓存
 */
export function clearLazyCache(entity: object): void {
  lazyCache.delete(entity);
}

/**
 * 检查关联是否已加载
 */
export function isRelationLoaded(entity: object, propertyKey: string): boolean {
  const cache = lazyCache.get(entity);
  return cache?.has(propertyKey) ?? false;
}
