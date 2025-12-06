/**
 * 级联操作处理器
 */

import { Class, CascadeType, ValueType, RelationType } from '../types';
import { metadataStorage, RelationMetadata, EntityMetadata } from '../types/metadata';
import { DatabaseAdapter } from '../adapter/BaseAdapter';
import { classToTable, snakeToCamel, getLocalTimeString } from '../utils';

/**
 * 级联操作处理器
 */
export class CascadeHandler {
  private adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * 级联创建
   */
  cascadeCreate<T extends object>(entity: T, metadata: EntityMetadata): void {
    for (const relation of metadata.relations) {
      if (!this.shouldCascade(relation, CascadeType.Create)) continue;

      const relatedData = (entity as Record<string, unknown>)[relation.propertyKey];
      if (!relatedData) continue;

      const targetClass = this.getTargetClass(relation);
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) continue;

      const pkValue = this.getPrimaryKeyValue(entity, metadata);
      if (!pkValue) continue;

      if (Array.isArray(relatedData)) {
        for (const item of relatedData) {
          this.insertRelated(item as object, relation, targetMeta, pkValue, metadata.table.name);
        }
      } else {
        this.insertRelated(relatedData as object, relation, targetMeta, pkValue, metadata.table.name);
      }
    }
  }

  /**
   * 级联更新
   */
  cascadeUpdate<T extends object>(entity: T, metadata: EntityMetadata): void {
    for (const relation of metadata.relations) {
      if (!this.shouldCascade(relation, CascadeType.Update)) continue;

      const relatedData = (entity as Record<string, unknown>)[relation.propertyKey];
      if (!relatedData) continue;

      const targetClass = this.getTargetClass(relation);
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) continue;

      if (Array.isArray(relatedData)) {
        for (const item of relatedData) {
          this.updateRelated(item as object, targetMeta);
        }
      } else {
        this.updateRelated(relatedData as object, targetMeta);
      }
    }
  }

  /**
   * 级联删除
   */
  cascadeDelete<T extends object>(entity: T, metadata: EntityMetadata): void {
    const pkValue = this.getPrimaryKeyValue(entity, metadata);
    if (!pkValue) return;

    for (const relation of metadata.relations) {
      if (!this.shouldCascade(relation, CascadeType.Delete)) continue;
      if (relation.type === RelationType.BelongsTo) continue; // BelongsTo 不级联删除

      const targetClass = this.getTargetClass(relation);
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) continue;

      const foreignKey = relation.foreignKey || this.inferForeignKey(relation, targetMeta.table.name, metadata.table.name);
      const foreignKeyCol = targetMeta.columns.find(c => c.propertyKey === foreignKey)?.name || foreignKey;

      const sql = `DELETE FROM ${targetMeta.table.name} WHERE ${foreignKeyCol} = ?`;
      this.adapter.executeSqlSync(sql, [pkValue]);
    }
  }

  /**
   * 级联软删除
   */
  cascadeSoftDelete<T extends object>(entity: T, metadata: EntityMetadata): void {
    const pkValue = this.getPrimaryKeyValue(entity, metadata);
    if (!pkValue) return;

    for (const relation of metadata.relations) {
      if (!this.shouldCascade(relation, CascadeType.Delete)) continue;
      if (relation.type === RelationType.BelongsTo) continue;

      const targetClass = this.getTargetClass(relation);
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) continue;

      const softDeleteCol = targetMeta.columns.find(c => c.isSoftDelete);
      if (!softDeleteCol) continue;

      const foreignKey = relation.foreignKey || this.inferForeignKey(relation, targetMeta.table.name, metadata.table.name);
      const foreignKeyCol = targetMeta.columns.find(c => c.propertyKey === foreignKey)?.name || foreignKey;

      const sql = `UPDATE ${targetMeta.table.name} SET ${softDeleteCol.name} = ? WHERE ${foreignKeyCol} = ?`;
      this.adapter.executeSqlSync(sql, [getLocalTimeString(), pkValue]);
    }
  }

  // ========== 私有方法 ==========

  private shouldCascade(relation: RelationMetadata, type: CascadeType): boolean {
    if (!relation.cascade) return false;
    return relation.cascade.includes(type) || relation.cascade.includes(CascadeType.All);
  }

  private getTargetClass(relation: RelationMetadata): Class {
    return typeof relation.target === 'function' && relation.target.prototype
      ? relation.target as Class
      : (relation.target as () => Class)();
  }

  private getPrimaryKeyValue<T extends object>(entity: T, metadata: EntityMetadata): ValueType | undefined {
    if (!metadata.primaryKey) return undefined;
    return (entity as Record<string, unknown>)[metadata.primaryKey.propertyKey] as ValueType;
  }

  private insertRelated(
    item: object,
    relation: RelationMetadata,
    targetMeta: EntityMetadata,
    parentPkValue: ValueType,
    parentTable: string
  ): void {
    const foreignKey = relation.foreignKey || this.inferForeignKey(relation, targetMeta.table.name, parentTable);
    const foreignKeyCol = targetMeta.columns.find(c => c.propertyKey === foreignKey)?.name || foreignKey;

    // 设置外键值
    (item as Record<string, unknown>)[foreignKey] = parentPkValue;

    // 构建插入数据
    const values: Record<string, ValueType> = {};
    for (const col of targetMeta.columns) {
      if (col.isPrimaryKey && col.isAutoIncrement) continue;
      const value = (item as Record<string, unknown>)[col.propertyKey];
      if (value !== undefined) {
        values[col.name] = value as ValueType;
      }
    }

    // 确保外键被设置
    values[foreignKeyCol] = parentPkValue;

    this.adapter.insert(targetMeta.table.name, values);
  }

  private updateRelated(item: object, targetMeta: EntityMetadata): void {
    if (!targetMeta.primaryKey) return;

    const pkValue = (item as Record<string, unknown>)[targetMeta.primaryKey.propertyKey] as ValueType;
    if (!pkValue) return;

    const values: Record<string, ValueType> = {};
    for (const col of targetMeta.columns) {
      if (col.isPrimaryKey) continue;
      const value = (item as Record<string, unknown>)[col.propertyKey];
      if (value !== undefined) {
        values[col.name] = value as ValueType;
      }
    }

    if (Object.keys(values).length === 0) return;

    this.adapter.update(
      targetMeta.table.name,
      values,
      `${targetMeta.primaryKey.name} = ?`,
      [pkValue]
    );
  }

  private inferForeignKey(relation: RelationMetadata, targetTable: string, currentTable: string): string {
    if (relation.type === RelationType.BelongsTo) {
      return snakeToCamel(targetTable) + 'Id';
    }
    return currentTable + '_id';
  }
}

/**
 * 创建级联处理器
 */
export function createCascadeHandler(adapter: DatabaseAdapter): CascadeHandler {
  return new CascadeHandler(adapter);
}
