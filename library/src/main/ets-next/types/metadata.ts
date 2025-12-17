/**
 * 元数据类型定义
 */

import { ColumnType, RelationType, CascadeType, Class } from './index';

/**
 * 表元数据
 */
export interface TableMetadata {
  name: string;
  className: string;
}

/**
 * 列元数据
 */
export interface ColumnMetadata {
  propertyKey: string;
  name: string;
  type: ColumnType;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isNotNull: boolean;
  isAutoCreateTime: boolean;
  isAutoUpdateTime: boolean;
  isSoftDelete: boolean;
  defaultValue?: unknown;
}

/**
 * 关联元数据
 */
export interface RelationMetadata {
  propertyKey: string;
  type: RelationType;
  target: Class | (() => Class);
  foreignKey?: string;
  localKey?: string;
  through?: string | Class;
  throughForeignKey?: string;
  throughOtherKey?: string;
  cascade?: CascadeType[];
  lazy?: boolean;
}

/**
 * 实体元数据
 */
export interface EntityMetadata {
  table: TableMetadata;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
  primaryKey?: ColumnMetadata;
  primaryKeys: ColumnMetadata[];  // 支持复合主键
}

/**
 * 元数据存储 Symbol
 */
export const METADATA_KEY = {
  TABLE: Symbol('orm:table'),
  COLUMNS: Symbol('orm:columns'),
  RELATIONS: Symbol('orm:relations')
};

/**
 * 元数据存储器
 */
class MetadataStorage {
  private entities: Map<Class, EntityMetadata> = new Map();
  private entitiesByName: Map<string, EntityMetadata> = new Map();

  /**
   * 注册表元数据
   */
  setTableMetadata(target: Class, metadata: TableMetadata): void {
    const entity = this.getOrCreateEntity(target);
    entity.table = metadata;
    // 同时按类名索引，支持装饰器包装类的查找
    this.entitiesByName.set(target.name, entity);
  }

  /**
   * 添加列元数据
   */
  addColumnMetadata(target: Class, metadata: ColumnMetadata): void {
    const entity = this.getOrCreateEntity(target);
    const existingIndex = entity.columns.findIndex(c => c.propertyKey === metadata.propertyKey);
    if (existingIndex >= 0) {
      entity.columns[existingIndex] = metadata;
      // 更新 primaryKeys 数组
      if (metadata.isPrimaryKey) {
        const pkIndex = entity.primaryKeys.findIndex(pk => pk.propertyKey === metadata.propertyKey);
        if (pkIndex >= 0) {
          entity.primaryKeys[pkIndex] = metadata;
        }
      }
    } else {
      entity.columns.push(metadata);
    }
    if (metadata.isPrimaryKey) {
      entity.primaryKey = metadata;
      // 添加到复合主键数组
      if (!entity.primaryKeys.some(pk => pk.propertyKey === metadata.propertyKey)) {
        entity.primaryKeys.push(metadata);
      }
    }
  }

  /**
   * 添加关联元数据
   */
  addRelationMetadata(target: Class, metadata: RelationMetadata): void {
    const entity = this.getOrCreateEntity(target);
    const existingIndex = entity.relations.findIndex(r => r.propertyKey === metadata.propertyKey);
    if (existingIndex >= 0) {
      entity.relations[existingIndex] = metadata;
    } else {
      entity.relations.push(metadata);
    }
  }

  /**
   * 获取实体元数据
   * 支持按类引用查找，如果找不到则按类名查找（兼容 @ObservedV2 等装饰器包装类）
   */
  getEntityMetadata(target: Class): EntityMetadata | undefined {
    // 优先按类引用查找
    let entity = this.entities.get(target);
    if (entity) return entity;
    // 按类名查找（兼容装饰器包装类）
    entity = this.entitiesByName.get(target.name);
    if (entity) {
      // 缓存到 entities 中，避免重复查找
      this.entities.set(target, entity);
      return entity;
    }
    return undefined;
  }

  /**
   * 获取或创建实体元数据
   */
  private getOrCreateEntity(target: Class): EntityMetadata {
    let entity = this.entities.get(target);
    if (!entity) {
      // 先尝试按类名查找已存在的元数据（可能由其他装饰器先注册）
      entity = this.entitiesByName.get(target.name);
      if (entity) {
        // 将已存在的元数据也关联到当前类引用
        this.entities.set(target, entity);
        return entity;
      }
      // 创建新的元数据
      entity = {
        table: { name: '', className: target.name },
        columns: [],
        relations: [],
        primaryKeys: []
      };
      this.entities.set(target, entity);
      this.entitiesByName.set(target.name, entity);
    }
    return entity;
  }

  /**
   * 标记列为非空
   */
  markColumnNotNull(target: Class, propertyKey: string): void {
    const entity = this.getOrCreateEntity(target);
    const col = entity.columns.find(c => c.propertyKey === propertyKey);
    if (col) {
      col.isNotNull = true;
    } else {
      // 列还未注册，先存储待处理标记
      this.pendingNotNull.set(`${target.name}:${propertyKey}`, true);
    }
  }

  private pendingNotNull: Map<string, boolean> = new Map();

  /**
   * 应用待处理的 NotNull 标记
   */
  applyPendingNotNull(target: Class, propertyKey: string, metadata: ColumnMetadata): void {
    const key = `${target.name}:${propertyKey}`;
    if (this.pendingNotNull.has(key)) {
      metadata.isNotNull = true;
      this.pendingNotNull.delete(key);
    }
  }

  /**
   * 清空所有元数据
   */
  clear(): void {
    this.entities.clear();
    this.entitiesByName.clear();
    this.pendingNotNull.clear();
  }
}

/**
 * 全局元数据存储实例
 */
export const metadataStorage = new MetadataStorage();
