import { Class } from "../decorator/Index";
import { RelationMapping } from "./RelationTypes";
import { getRelationManager } from "./RelationManager";
import { AnyType } from "../model/Global.type";

/**
 * 关联查询选项
 */
export interface RelationQueryOptions {
  /** 预加载的关联 */
  preload?: string[];
  /** 关联查询条件 */
  with?: { [relation: string]: any };
  /** 是否启用延迟加载 */
  lazy?: boolean;
}


/**
 * 关联查询构建器
 */
export class RelationQueryBuilder {
  private entityClass: Class;
  private relationManager = getRelationManager();
  private preloadRelations: Set<string> = new Set();
  private withConditions: Map<string, AnyType> = new Map();

  constructor(entityClass: Class) {
    this.entityClass = entityClass;
  }

  /**
   * 预加载关联数据
   */
  preload(relations: string | string[]): this {
    const relationList = Array.isArray(relations) ? relations : [relations];

    for (const relation of relationList) {
      this.validateRelationPath(relation);
      this.preloadRelations.add(relation);
    }

    return this;
  }

  /**
   * 添加关联查询条件
   */
  with(relation: string, condition?: AnyType): this {
    this.validateRelationPath(relation);
    this.preloadRelations.add(relation);

    if (condition) {
      this.withConditions.set(relation, condition);
    }

    return this;
  }


  /**
   * 验证关联路径
   */
  private validateRelationPath(path: string): void {
    try {
      this.relationManager.getRelationPath(this.entityClass, path);
    } catch (error) {
      throw new Error(`无效的关联路径: ${path}`);
    }
  }

  /**
   * 获取表名
   */
  private getTableName(entityClass: Class): string {
    // 这里需要导入GetTableName，但为了避免循环依赖，暂时使用简单实现
    return (entityClass as Class).__TableMeta__?.name || '';
  }

  /**
   * 生成预加载SQL查询
   */
  buildPreloadQueries(): { [relation: string]: string } {
    const queries: { [relation: string]: string } = {};

    for (const relation of this.preloadRelations) {
      const mapping = this.relationManager.getRelationMapping(this.entityClass, relation);
      if (mapping) {
        queries[relation] = this.buildRelationQuery(mapping);
      }
    }

    return queries;
  }

  /**
   * 构建单个关联查询SQL
   */
  private buildRelationQuery(mapping: RelationMapping): string {
    const targetTable = this.getTableName(mapping.targetClass);
    const condition = this.withConditions.get(mapping.propertyKey);

    let sql = `SELECT * FROM ${targetTable}`;

    // 添加关联条件
    switch (mapping.type) {
      case 'hasOne':
      case 'hasMany':
        sql += ` WHERE ${mapping.foreignKey} = ?`;
        break;

      case 'belongsTo':
        sql += ` WHERE ${mapping.localKey} = ?`;
        break;

      case 'manyToMany':
        if (mapping.through) {
          sql = `SELECT t.* FROM ${targetTable} t
                 INNER JOIN ${mapping.through.table} mt ON t.${mapping.localKey} = mt.${mapping.through.otherKey}
                 WHERE mt.${mapping.through.foreignKey} = ?`;
        }
        break;
    }

    // 添加额外条件
    if (condition) {
      sql += ` AND ${this.buildConditionSQL(condition)}`;
    }

    return sql;
  }

  /**
   * 构建条件SQL
   */
  private buildConditionSQL(condition: AnyType): string {
    // 简单实现，实际应该更复杂
    if (typeof condition === 'object') {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(condition)) {
        conditions.push(`${key} = '${value}'`);
      }
      return conditions.join(' AND ');
    }
    return String(condition);
  }

  /**
   * 获取预加载关联列表
   */
  getPreloadRelations(): string[] {
    return Array.from(this.preloadRelations);
  }

  /**
   * 清空所有配置
   */
  clear(): this {
    this.preloadRelations.clear();
    this.withConditions.clear();
    return this;
  }
}
