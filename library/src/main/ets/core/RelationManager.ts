import { RelationConfig, RelationType } from "../decorator/Relation";
import { RelationMapping } from "./RelationTypes";
import { GetTableName, GetRelationMeta } from "../decorator/Index";
import { Class } from "../decorator/Index";
import { camelToSnakeCase } from "../utils/Utils";

/**
 * 关联映射管理器
 * 负责解析关联配置，构建关联映射表和索引
 */
export class RelationManager {
  private static instance: RelationManager;

  /** 关联映射表：源类 -> 属性名 -> 关联映射 */
  private relationMappings: Map<Function, Map<string, RelationMapping>> = new Map();

  /** 反向关联索引：目标类 -> 源类列表 */
  private reverseIndex: Map<Function, Set<Function>> = new Map();

  /** 已注册的实体类 */
  private registeredClasses: Set<Function> = new Set();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): RelationManager {
    if (!RelationManager.instance) {
      RelationManager.instance = new RelationManager();
    }
    return RelationManager.instance;
  }

  /**
   * 注册实体类，解析其关联配置
   */
  registerEntity(entityClass: Class): void {
    if (this.registeredClasses.has(entityClass)) {
      return;
    }

    this.registeredClasses.add(entityClass);
    const relations = GetRelationMeta(entityClass);

    if (relations && relations.length > 0) {
      const mappings = new Map<string, RelationMapping>();

      for (const relation of relations) {
        const mapping = this.parseRelationConfig(entityClass, relation);
        mappings.set(relation.propertyKey!, mapping);

        // 构建反向索引
        const targetClass = this.resolveTargetClass(relation.target);
        if (!this.reverseIndex.has(targetClass)) {
          this.reverseIndex.set(targetClass, new Set());
        }
        this.reverseIndex.get(targetClass)!.add(entityClass);
      }

      this.relationMappings.set(entityClass, mappings);
    }
  }

  /**
   * 解析关联配置为关联映射
   */
  private parseRelationConfig(sourceClass: Class, config: RelationConfig): RelationMapping {
    const targetClass = this.resolveTargetClass(config.target);
    const sourceTableName = GetTableName(sourceClass);
    const targetTableName = GetTableName(targetClass);

    // 解析键名
    const { foreignKey, localKey } = this.resolveKeys(config, sourceTableName, targetTableName);

    const mapping: RelationMapping = {
      sourceClass,
      targetClass,
      type: config.type,
      propertyKey: config.propertyKey!,
      foreignKey,
      localKey,
      cascade: config.cascade || [],
      lazy: config.lazy ?? true
    };

    // 处理多对多关联的中间表
    if (config.type === RelationType.ManyToMany) {
      mapping.through = this.resolveThroughTable(config, sourceTableName, targetTableName);
    }

    return mapping;
  }

  /**
   * 解析目标类
   */
  private resolveTargetClass(target: Class | (() => Class)): Class {
    return typeof target === 'function' && target.length === 0 ? (target as () => Class)() : target as Class;
  }

  /**
   * 解析外键和本地键
   */
  private resolveKeys(config: RelationConfig, sourceTable: string, targetTable: string): { foreignKey: string; localKey: string } {
    let foreignKey: string;
    let localKey: string;

    switch (config.type) {
      case RelationType.HasOne:
      case RelationType.HasMany:
        // 一对一/一对多：外键在目标表，本地键是源表主键
        foreignKey = config.foreignKey || `${camelToSnakeCase(sourceTable)}_id`;
        localKey = config.localKey || 'id';
        break;

      case RelationType.BelongsTo:
        // 多对一：外键在源表，本地键是目标表主键
        foreignKey = config.foreignKey || `${camelToSnakeCase(targetTable)}_id`;
        localKey = config.localKey || 'id';
        break;

      case RelationType.ManyToMany:
        // 多对多：通过中间表关联
        foreignKey = config.throughForeignKey || `${camelToSnakeCase(sourceTable)}_id`;
        localKey = config.localKey || 'id';
        break;

      default:
        throw new Error(`不支持的关联类型: ${config.type}`);
    }

    return { foreignKey, localKey };
  }

  /**
   * 解析多对多中间表配置
   */
  private resolveThroughTable(config: RelationConfig, sourceTable: string, targetTable: string): { table: string; foreignKey: string; otherKey: string } {
    const throughTable = typeof config.through === 'string'
      ? config.through
      : config.through
        ? GetTableName(config.through)
        : this.generateThroughTableName(sourceTable, targetTable);

    const foreignKey = config.throughForeignKey || `${camelToSnakeCase(sourceTable.replace(/s$/, ''))}_id`;
    const otherKey = config.throughOtherKey || `${camelToSnakeCase(targetTable.replace(/s$/, ''))}_id`;

    return {
      table: throughTable,
      foreignKey,
      otherKey
    };
  }

  /**
   * 生成默认的中间表名
   */
  private generateThroughTableName(table1: string, table2: string): string {
    // 按字母顺序排序表名，确保一致性
    const tables = [table1.replace(/s$/, ''), table2.replace(/s$/, '')].sort();
    return `${tables[0]}_${tables[1]}s`;
  }

  /**
   * 获取实体的关联映射
   */
  getRelationMappings(entityClass: Class): Map<string, RelationMapping> | undefined {
    return this.relationMappings.get(entityClass);
  }

  /**
   * 获取指定属性的关联映射
   */
  getRelationMapping(entityClass: Class, propertyKey: string): RelationMapping | undefined {
    const mappings = this.relationMappings.get(entityClass);
    return mappings?.get(propertyKey);
  }

  /**
   * 获取实体的所有关联映射数组
   */
  getRelationMappingList(entityClass: Class): RelationMapping[] {
    const mappings = this.relationMappings.get(entityClass);
    return mappings ? Array.from(mappings.values()) : [];
  }

  /**
   * 检查实体是否有关联关系
   */
  hasRelations(entityClass: Class): boolean {
    const mappings = this.relationMappings.get(entityClass);
    return mappings !== undefined && mappings.size > 0;
  }

  /**
   * 获取指向目标实体的所有关联
   */
  getRelationsToTarget(targetClass: Class): RelationMapping[] {
    const sourceClasses = this.reverseIndex.get(targetClass);
    if (!sourceClasses) {
      return [];
    }

    const relations: RelationMapping[] = [];
    for (const sourceClass of sourceClasses) {
      const mappings = this.relationMappings.get(sourceClass);
      if (mappings) {
        for (const mapping of mappings.values()) {
          if (mapping.targetClass === targetClass) {
            relations.push(mapping);
          }
        }
      }
    }

    return relations;
  }

  /**
   * 获取关联路径（用于深度关联查询）
   */
  getRelationPath(entityClass: Class, path: string): RelationMapping[] {
    const pathSegments = path.split('.');
    const mappings: RelationMapping[] = [];
    let currentClass = entityClass;

    for (const segment of pathSegments) {
      const mapping = this.getRelationMapping(currentClass, segment);
      if (!mapping) {
        throw new Error(`关联路径 '${path}' 在 ${currentClass.name} 中不存在`);
      }

      mappings.push(mapping);
      currentClass = mapping.targetClass as Class;
    }

    return mappings;
  }

  /**
   * 验证关联配置的有效性
   */
  validateRelations(): string[] {
    const errors: string[] = [];

    for (const [sourceClass, mappings] of this.relationMappings) {
      for (const [propertyKey, mapping] of mappings) {
        try {
          this.validateRelationMapping(mapping);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`${sourceClass.name}.${propertyKey}: ${errorMsg}`);
        }
      }
    }

    return errors;
  }

  /**
   * 验证单个关联映射
   */
  private validateRelationMapping(mapping: RelationMapping): void {
    // 检查目标类是否已注册
    if (!this.registeredClasses.has(mapping.targetClass)) {
      throw new Error(`目标实体类 ${mapping.targetClass.name} 未注册`);
    }

    // 检查多对多关联的中间表配置
    if (mapping.type === RelationType.ManyToMany && !mapping.through) {
      throw new Error('多对多关联必须配置中间表');
    }

    // 可以添加更多验证逻辑...
  }

  /**
   * 清空所有关联映射（用于测试）
   */
  clear(): void {
    this.relationMappings.clear();
    this.reverseIndex.clear();
    this.registeredClasses.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): { entityCount: number; relationCount: number; reverseIndexSize: number } {
    let relationCount = 0;
    for (const mappings of this.relationMappings.values()) {
      relationCount += mappings.size;
    }

    return {
      entityCount: this.registeredClasses.size,
      relationCount,
      reverseIndexSize: this.reverseIndex.size
    };
  }
}

/**
 * 获取全局关联管理器实例
 */
export function getRelationManager(): RelationManager {
  return RelationManager.getInstance();
}