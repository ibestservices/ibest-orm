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
      if (!this.shouldCascade(relation, CascadeType.Create)) {
        continue;
      }

      const relatedData = (entity as Record<string, unknown>)[relation.propertyKey];
      if (!relatedData) continue;

      const targetClass = this.getTargetClass(relation);
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) continue;

      const pkValue = this.getPrimaryKeyValue(entity, metadata);
      if (!pkValue) continue;

      // ManyToMany 特殊处理
      if (relation.type === RelationType.ManyToMany) {
        this.createManyToMany(relatedData as object[], relation, targetMeta, pkValue);
        continue;
      }

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
    const pkValue = this.getPrimaryKeyValue(entity, metadata);

    for (const relation of metadata.relations) {
      if (!this.shouldCascade(relation, CascadeType.Update)) continue;

      const relatedData = (entity as Record<string, unknown>)[relation.propertyKey];
      if (!relatedData) continue;

      const targetClass = this.getTargetClass(relation);
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) continue;

      // ManyToMany 特殊处理：同步关联关系
      if (relation.type === RelationType.ManyToMany && pkValue) {
        this.updateManyToMany(relatedData as object[], relation, targetMeta, pkValue);
        continue;
      }

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

      // ManyToMany 特殊处理：只删除中间表关联
      if (relation.type === RelationType.ManyToMany) {
        this.deleteManyToMany(relation, pkValue);
        continue;
      }

      const targetClass = this.getTargetClass(relation);
      const targetMeta = metadataStorage.getEntityMetadata(targetClass);
      if (!targetMeta) continue;

      // foreignKey 可能是数据库列名或属性名
      const foreignKey = relation.foreignKey || this.inferForeignKey(relation, targetMeta.table.name, metadata.table.name);
      // 先按列名查找，再按属性名查找
      const foreignKeyColMeta = targetMeta.columns.find(c => c.name === foreignKey)
        || targetMeta.columns.find(c => c.propertyKey === foreignKey);
      const foreignKeyCol = foreignKeyColMeta?.name || foreignKey;

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

      // foreignKey 可能是数据库列名或属性名
      const foreignKey = relation.foreignKey || this.inferForeignKey(relation, targetMeta.table.name, metadata.table.name);
      const foreignKeyColMeta = targetMeta.columns.find(c => c.name === foreignKey)
        || targetMeta.columns.find(c => c.propertyKey === foreignKey);
      const foreignKeyCol = foreignKeyColMeta?.name || foreignKey;

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
    // foreignKey 可能是数据库列名（如 user_id）或属性名（如 userId）
    const foreignKey = relation.foreignKey || this.inferForeignKey(relation, targetMeta.table.name, parentTable);

    // 查找对应的列元数据：先按列名查找，再按属性名查找
    const foreignKeyColMeta = targetMeta.columns.find(c => c.name === foreignKey)
      || targetMeta.columns.find(c => c.propertyKey === foreignKey);

    // 获取属性名和列名
    const foreignKeyProp = foreignKeyColMeta?.propertyKey || foreignKey;
    const foreignKeyCol = foreignKeyColMeta?.name || foreignKey;

    // 设置外键值（使用属性名）
    (item as Record<string, unknown>)[foreignKeyProp] = parentPkValue;

    // 构建插入数据
    const values: Record<string, ValueType> = {};
    for (const col of targetMeta.columns) {
      if (col.isPrimaryKey && col.isAutoIncrement) continue;
      const value = (item as Record<string, unknown>)[col.propertyKey];
      if (value !== undefined) {
        values[col.name] = value as ValueType;
      }
    }

    // 确保外键被设置（使用列名）
    values[foreignKeyCol] = parentPkValue;

    const rowId = this.adapter.insert(targetMeta.table.name, values);

    // 回写主键到关联对象
    if (targetMeta.primaryKey && rowId > 0) {
      (item as Record<string, unknown>)[targetMeta.primaryKey.propertyKey] = rowId;
    }
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

  /**
   * ManyToMany 级联创建：插入关联实体并建立中间表关联
   */
  private createManyToMany(
    items: object[],
    relation: RelationMetadata,
    targetMeta: EntityMetadata,
    parentPkValue: ValueType
  ): void {
    if (!relation.through || typeof relation.through !== 'string') return;
    if (!targetMeta.primaryKey) return;

    const throughTable = relation.through;
    const fk1 = relation.throughForeignKey || 'source_id';
    const fk2 = relation.throughOtherKey || 'target_id';

    for (const item of items) {
      let targetPkValue = (item as Record<string, unknown>)[targetMeta.primaryKey.propertyKey] as ValueType;

      // 如果关联实体没有主键，先插入它
      if (!targetPkValue) {
        const values: Record<string, ValueType> = {};
        for (const col of targetMeta.columns) {
          if (col.isPrimaryKey && col.isAutoIncrement) continue;
          const value = (item as Record<string, unknown>)[col.propertyKey];
          if (value !== undefined) {
            values[col.name] = value as ValueType;
          }
        }
        const rowId = this.adapter.insert(targetMeta.table.name, values);
        if (rowId > 0) {
          (item as Record<string, unknown>)[targetMeta.primaryKey.propertyKey] = rowId;
          targetPkValue = rowId;
        }
      }

      if (!targetPkValue) continue;

      // 插入中间表记录
      const sql = `INSERT OR IGNORE INTO ${throughTable} (${fk1}, ${fk2}) VALUES (?, ?)`;
      this.adapter.executeSqlSync(sql, [parentPkValue, targetPkValue]);
    }
  }

  /**
   * ManyToMany 级联更新：同步关联关系（删除旧的，插入新的）
   */
  private updateManyToMany(
    items: object[],
    relation: RelationMetadata,
    targetMeta: EntityMetadata,
    parentPkValue: ValueType
  ): void {
    // 先删除旧的中间表记录
    this.deleteManyToMany(relation, parentPkValue);
    // 再创建新的关联
    this.createManyToMany(items, relation, targetMeta, parentPkValue);
  }

  /**
   * ManyToMany 级联删除：删除中间表关联
   */
  private deleteManyToMany(relation: RelationMetadata, parentPkValue: ValueType): void {
    if (!relation.through || typeof relation.through !== 'string') return;

    const throughTable = relation.through;
    const fk1 = relation.throughForeignKey || 'source_id';

    const sql = `DELETE FROM ${throughTable} WHERE ${fk1} = ?`;
    this.adapter.executeSqlSync(sql, [parentPkValue]);
  }
}

/**
 * 创建级联处理器
 */
export function createCascadeHandler(adapter: DatabaseAdapter): CascadeHandler {
  return new CascadeHandler(adapter);
}
