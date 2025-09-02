import { Class, GetRelationMeta } from "../decorator/Index";
import { RelationManager, getRelationManager } from "./RelationManager";
import { RelationConfig, RelationType } from "../decorator/Relation";
import { IBestORM } from "./SQLiteORM";

/**
 * 元数据收集器
 * 负责自动发现和收集实体类的关联元数据
 */
export class MetadataCollector {
  private static instance: MetadataCollector;
  private relationManager: RelationManager;
  private collectedClasses: Set<Class> = new Set();

  private constructor() {
    this.relationManager = getRelationManager();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): MetadataCollector {
    if (!MetadataCollector.instance) {
      MetadataCollector.instance = new MetadataCollector();
    }
    return MetadataCollector.instance;
  }

  /**
   * 收集实体类的元数据
   * 传入IBestORM会自动创建多对多关联关系表
   */
  collect(entityClass: Class, orm?: IBestORM): void {
    if (this.collectedClasses.has(entityClass)) {
      return;
    }

    this.collectedClasses.add(entityClass);

    // 注册到关联管理器
    this.relationManager.registerEntity(entityClass);

    // 递归收集关联的实体类
    this.collectRelatedEntities(entityClass, orm);

    // 自动创建多对多关联表
    if(orm) this.autoCreateManyToManyTables(entityClass, orm);
  }

  /**
   * 递归收集关联的实体类
   */
  private collectRelatedEntities(entityClass: Class, orm?: IBestORM): void {
    const relations = GetRelationMeta(entityClass);

    for (const relation of relations) {
      const targetClass = this.resolveTargetClass(relation.target);

      // 递归收集目标实体类
      if (!this.collectedClasses.has(targetClass)) {
        this.collect(targetClass, orm);
      }
    }
  }

  /**
   * 解析目标类
   */
  private resolveTargetClass(target: Class | (() => Class)): Class {
    return typeof target === 'function' && target.length === 0 ? (target as () => Class)() : target as Class;
  }

  /**
   * 验证所有收集的关联配置
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors = this.relationManager.validateRelations();
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取收集统计信息
   */
  getStats(): {
    collectedClasses: number;
    relationMappings: number;
    validationErrors: number;
    relationManagerStats: { entityCount: number; relationCount: number; reverseIndexSize: number };
  } {
    const validation = this.validate();
    const rmStats = this.relationManager.getStats();

    return {
      collectedClasses: this.collectedClasses.size,
      relationMappings: rmStats.relationCount,
      validationErrors: validation.errors.length,
      relationManagerStats: rmStats
    };
  }

  /**
   * 清空所有收集的元数据
   */
  clear(): void {
    this.collectedClasses.clear();
    this.relationManager.clear();
  }

  /**
   * 自动创建多对多关联表
   */
  private autoCreateManyToManyTables(entityClass: Class, orm: IBestORM): void {
    const relations = GetRelationMeta(entityClass);
    
    for (const relation of relations) {
      if (relation.type === RelationType.ManyToMany && relation.through) {
        this.createManyToManyTable(relation, orm);
      }
    }
  }

  /**
   * 创建多对多关联表
   */
  private createManyToManyTable(relation: RelationConfig, orm: IBestORM): void {
    try {
      const tableName = relation.through;
      const foreignKey = relation.throughForeignKey || 'source_id';
      const otherKey = relation.throughOtherKey || 'target_id';

      // 检查表是否已存在
      if (orm.Migrator().HasTable(tableName)) {
        console.log(`多对多关联表 ${tableName} 已存在，跳过创建`);
        return;
      }

      // 创建多对多关联表的SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${foreignKey} INTEGER NOT NULL,
          ${otherKey} INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(${foreignKey}, ${otherKey})
        )
      `;

      // 执行创建表的SQL
      orm.GetCore().executeSync(createTableSQL);
      // 创建索引以提高查询性能
      const createIndexSQL1 = `CREATE INDEX IF NOT EXISTS idx_${tableName}_${foreignKey} ON ${tableName}(${foreignKey})`;
      const createIndexSQL2 = `CREATE INDEX IF NOT EXISTS idx_${tableName}_${otherKey} ON ${tableName}(${otherKey})`;
      orm.GetCore().executeSync(createIndexSQL1);
      orm.GetCore().executeSync(createIndexSQL2);

      console.log(`自动创建多对多关联表: ${tableName}`);
    } catch (error) {
      console.error(`创建多对多关联表失败:`, error);
    }
  }

  /**
   * 获取关联管理器实例
   */
  getRelationManager(): RelationManager {
    return this.relationManager;
  }
}

/**
 * 获取全局元数据收集器实例
 */
export function getMetadataCollector(): MetadataCollector {
  return MetadataCollector.getInstance();
}