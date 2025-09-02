/**
 * 级联操作管理器
 * 支持关联数据的自动创建、更新、删除，提供事务管理和回滚机制
 */

import { RelationConfig, CascadeType, RelationType } from '../decorator/Relation';
import { IBestORM } from './SQLiteORM';
import { RelationManager } from './RelationManager';
import { RelationMapping } from './RelationTypes';
import { relationalStore } from '@kit.ArkData';
import { Class, GetColumnMeta, GetTableName } from '../decorator/Index';
import { AnyType } from '../model/Global.type';

/**
 * 级联操作类型枚举
 */
export enum CascadeOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SAVE = 'save'
}

/**
 * 级联操作配置接口
 */
export interface CascadeConfig {
  operation: CascadeOperation;
  cascadeTypes: CascadeType[];
  maxDepth?: number;
  transactionEnabled?: boolean;
  rollbackOnError?: boolean;
  batchSize?: number;
}

/**
 * 级联操作结果接口
 */
export interface CascadeResult {
  success: boolean;
  affectedEntities: Map<string, Object[]>;
  errors: CascadeError[];
  executionTime: number;
  operationCount: number;
}

/**
 * 级联操作错误接口
 */
export interface CascadeError {
  entity: Object;
  relation: string;
  operation: CascadeOperation;
  error: Error;
  rollbackRequired: boolean;
}

/**
 * 级联操作上下文接口
 */
export interface CascadeContext {
  rootEntity: Object;
  currentDepth: number;
  maxDepth: number;
  visitedEntities: Set<Object>;
  affectedEntities: Map<string, Object[]>;
  errors: CascadeError[];
  transactionId?: string;
}

/**
 * 级联操作管理器类
 */
export class CascadeManager {
  private static instance: CascadeManager;
  private orm: IBestORM;
  private relationManager: RelationManager;
  private defaultConfig: CascadeConfig;

  private constructor(orm: IBestORM) {
    this.orm = orm;
    this.relationManager = RelationManager.getInstance();
    this.defaultConfig = {
      operation: CascadeOperation.SAVE,
      cascadeTypes: [CascadeType.All],
      maxDepth: 5,
      transactionEnabled: true,
      rollbackOnError: true,
      batchSize: 100
    };
  }

  /**
   * 获取级联管理器实例
   */
  public static getInstance(orm?: IBestORM): CascadeManager {
    if (!CascadeManager.instance) {
      if (!orm) {
        throw new Error('ORM instance required for first initialization');
      }
      CascadeManager.instance = new CascadeManager(orm);
    }
    return CascadeManager.instance;
  }

  /**
   * 设置默认配置
   */
  public setDefaultConfig(config: Partial<CascadeConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * 获取默认配置
   */
  public getDefaultConfig(): CascadeConfig {
    return { ...this.defaultConfig };
  }

  /**
   * 执行级联创建操作
   */
  public async cascadeCreate(entity: Object, entityClass: Class, config?: Partial<CascadeConfig>): Promise<CascadeResult> {
    const mergedConfig: CascadeConfig = {
      ...this.defaultConfig,
      ...config,
      operation: CascadeOperation.CREATE
    };

    return this.executeCascadeOperation(entity, entityClass, mergedConfig);
  }

  /**
   * 执行级联更新操作
   */
  public async cascadeUpdate(entity: Object, entityClass: Class, config?: Partial<CascadeConfig>): Promise<CascadeResult> {
    const mergedConfig: CascadeConfig = {
      ...this.defaultConfig,
      ...config,
      operation: CascadeOperation.UPDATE
    };

    return this.executeCascadeOperation(entity, entityClass, mergedConfig);
  }

  /**
   * 执行级联删除操作
   */
  public async cascadeDelete(entity: Object, entityClass: Class, config?: Partial<CascadeConfig>): Promise<CascadeResult> {
    const mergedConfig: CascadeConfig = {
      ...this.defaultConfig,
      ...config,
      operation: CascadeOperation.DELETE
    };

    return this.executeCascadeOperation(entity, entityClass, mergedConfig);
  }

  /**
   * 执行级联保存操作（创建或更新）
   */
  public async cascadeSave(entity: Object, entityClass: Class, config?: Partial<CascadeConfig>): Promise<CascadeResult> {
    const mergedConfig: CascadeConfig = {
      ...this.defaultConfig,
      ...config,
      operation: CascadeOperation.SAVE
    };

    return this.executeCascadeOperation(entity, entityClass, mergedConfig);
  }

  /**
   * 生成事务ID
   */
  private generateTransactionId(): string {
    return `cascade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 执行级联操作
   */
  private async executeCascadeOperation(entity: Object, entityClass: Class, config: CascadeConfig): Promise<CascadeResult> {
    const startTime = Date.now();
    const context: CascadeContext = {
      rootEntity: entity,
      currentDepth: 0,
      maxDepth: config.maxDepth || 5,
      visitedEntities: new Set(),
      affectedEntities: new Map(),
      errors: []
    };

    let transactionStarted = false;

    try {
      // 开始事务
      if (config.transactionEnabled) {
        this.orm.Begin();
        transactionStarted = true;
        context.transactionId = this.generateTransactionId();
      }

      // 执行级联操作
      await this.performCascadeOperation(entity, entityClass, config, context);

      // 提交事务
      if (transactionStarted) {
        this.orm.Commit();
      }

      const endTime = Date.now();
      const operationCount = Array.from(context.affectedEntities.values())
        .reduce((sum, entities) => sum + entities.length, 0);

      return {
        success: context.errors.length === 0,
        affectedEntities: context.affectedEntities,
        errors: context.errors,
        executionTime: endTime - startTime,
        operationCount
      };

    } catch (error) {
      // 回滚事务
      if (transactionStarted && config.rollbackOnError) {
        try {
          this.orm.Rollback();
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError);
        }
      }

      context.errors.push({
        entity,
        relation: 'root',
        operation: config.operation,
        error: error as Error,
        rollbackRequired: true
      });

      const endTime = Date.now();
      return {
        success: false,
        affectedEntities: context.affectedEntities,
        errors: context.errors,
        executionTime: endTime - startTime,
        operationCount: 0
      };
    }
  }

  /**
   * 执行具体的级联操作
   */
  private async performCascadeOperation(entity: Object, entityClass: Class, config: CascadeConfig, context: CascadeContext): Promise<void> {
    console.log(`开始执行级联操作 - 实体类: ${entityClass.name}, 操作: ${config.operation}, 深度: ${context.currentDepth}`);
    
    // 检查深度限制
    if (context.currentDepth >= context.maxDepth) {
      console.log(`达到最大深度限制: ${context.maxDepth}`);
      return;
    }

    // 检查是否已访问过（避免循环引用）
    if (context.visitedEntities.has(entity)) {
      console.log(`实体已访问过，跳过处理`);
      return;
    }

    context.visitedEntities.add(entity);

    try {
      // 执行当前实体的操作
      console.log(`执行实体操作 - 实体数据:`, JSON.stringify(entity));
      await this.performEntityOperation(entity, entityClass, config, context);

      // 获取实体的关联配置
      const relations = this.relationManager.getRelationMappings(entityClass);
      console.log(`获取到关联配置数量: ${relations ? relations.size : 0}`);

      // 处理每个关联
      if (relations) {
        for (const [propertyKey, relation] of relations) {
          console.log(`处理关联: ${propertyKey}, 类型: ${relation.type}`);
          await this.processCascadeRelation(
            entity,
            propertyKey,
            relation,
            config,
            { ...context, currentDepth: context.currentDepth + 1 }
          );
        }
      }

    } catch (error) {
      console.error(`级联操作执行失败:`, error);
      context.errors.push({
        entity,
        relation: 'self',
        operation: config.operation,
        error: error as Error,
        rollbackRequired: config.rollbackOnError || false
      });
    }
  }

  /**
   * 执行实体操作
   */
  private async performEntityOperation(entity: Object, entityClass: Class, config: CascadeConfig, context: CascadeContext): Promise<void> {
    const tableName = GetTableName(entityClass);

    if (!context.affectedEntities.has(tableName)) {
      context.affectedEntities.set(tableName, []);
    }

    switch (config.operation) {
      case CascadeOperation.CREATE:
        await this.createEntity(entity, entityClass, config);
        break;

      case CascadeOperation.UPDATE:
        await this.updateEntity(entity, entityClass);
        break;

      case CascadeOperation.DELETE:
        await this.deleteEntity(entity, entityClass);
        break;

      case CascadeOperation.SAVE:
        await this.saveEntity(entity, entityClass, config);
        break;
    }

    context.affectedEntities.get(tableName)!.push(entity);
  }

  /**
   * 创建实体
   */
  private async createEntity(entity: Object, entityClass: Class, config: CascadeConfig) {
    Object.setPrototypeOf(entity, entityClass.prototype);
    entity.constructor = entityClass;
    console.info('ibest-orm', `准备创建实体 ${entityClass.name}:`, JSON.stringify(entity));
    let rowId: number = await this.orm.Create(entity);
    
    // 确保实体的主键字段被正确设置
    if(rowId) {
      const primaryKey = this.getPrimaryKey(entityClass);
      entity[primaryKey] = rowId;
      
      if(!config.transactionEnabled) {
        this.orm.Session(entityClass).Where(primaryKey, rowId).First(entity);
      }
    }
    return rowId;
  }

  /**
   * 更新实体（仅更新已存在的实体）
   */
  private async updateEntity(entity: Object, entityClass: Class) {
    Object.setPrototypeOf(entity, entityClass.prototype);
    entity.constructor = entityClass;
    
    console.log(`更新实体 ${entityClass.name}`);
    console.log(`实体数据:`, JSON.stringify(entity));
    
    // 获取主键
    const primaryKey = this.getPrimaryKey(entityClass);
    const primaryValue = entity[primaryKey];
    
    if (!primaryValue) {
      throw new Error('更新操作要求实体必须有主键值');
    }
    
    // 检查实体是否存在
    const tableName = GetTableName(entityClass);
    const existing = this.orm.Table(tableName).Where(primaryKey, primaryValue).First();
    
    if (!existing || Object.keys(existing).length === 0) {
      throw new Error(`要更新的实体不存在: ${entityClass.name} id=${primaryValue}`);
    }
    
    try {
      // 使用 ORM 的 Save 方法，它会正确处理属性名到字段名的映射
      const result = await this.orm.Save(entity);
      console.log(`更新结果: ${result}`);
      return result;
    } catch (error) {
      console.error(`更新操作失败:`, error);
      console.error(`实体类:`, entityClass.name);
      console.error(`主键:`, primaryKey, '=', primaryValue);
      throw error;
    }
  }

  /**
   * 保存或更新实体（根据操作类型和主键值决定）
   */
  private async saveOrUpdateEntity(entity: Object, entityClass: Class, parentId: number, relation: RelationMapping, operation: CascadeOperation = CascadeOperation.SAVE) {
    Object.setPrototypeOf(entity, entityClass.prototype);
    entity.constructor = entityClass;
    
    const primaryKey = this.getPrimaryKey(entityClass);
    const primaryValue = entity[primaryKey];
    
    console.log(`处理实体 ${entityClass.name} - 主键: ${primaryKey}=${primaryValue}, 操作: ${operation}`);
    
    if (primaryValue) {
      // 有主键值，执行更新操作
      console.log(`更新现有实体: ${entityClass.name} id=${primaryValue}`);
      return await this.updateEntity(entity, entityClass);
    } else {
      // 无主键值的处理
      if (operation === CascadeOperation.UPDATE) {
        // UPDATE 操作不允许创建新实体
        console.warn(`UPDATE 操作跳过无主键的实体: ${entityClass.name}`);
        return 0;
      }
      
      // SAVE 操作允许创建新实体
      console.log(`插入新实体: ${entityClass.name}`);
      
      // 设置外键关联
      if (relation.type === 'hasOne' || relation.type === 'hasMany') {
        entity[relation.foreignKey] = parentId;
      }
      
      // 使用 Create 方法来插入新实体
      const result = await this.createEntity(entity, entityClass, {
        operation: CascadeOperation.CREATE,
        cascadeTypes: [CascadeType.All],
        transactionEnabled: false
      });
      
      // 处理多对多关联
      if (relation.type === 'manyToMany' && result > 0) {
        const newEntityId = entity[primaryKey] || result;
        if (newEntityId) {
          this.insertManyToManyRelations(parentId, [{ ...entity, [primaryKey]: newEntityId }], relation);
        }
      }
      
      return result;
    }
  }

  /**
   * 删除实体
   */
  private async deleteEntity(entity: Object, entityClass: Class) {
    Object.setPrototypeOf(entity, entityClass.prototype);
    entity.constructor = entityClass;
    return await this.orm.DeleteByEntity(entity);
  }

  /**
   * 保存实体（创建或更新）
   */
  private async saveEntity(entity: Object, entityClass: Class, config: CascadeConfig) {
    Object.setPrototypeOf(entity, entityClass.prototype);
    entity.constructor = entityClass;

    const primaryKey = this.getPrimaryKey(entityClass);
    const primaryValue = entity[primaryKey];

    if (primaryValue) {
      // 检查实体是否存在
      const tableName = GetTableName(entityClass);
      const existing = this.orm.Table(tableName).Where(primaryKey, primaryValue).First();

      if (existing) {
        return await this.updateEntity(entity, entityClass);
      } else {
        return await this.createEntity(entity, entityClass, config);
      }
    } else {
      return await this.createEntity(entity, entityClass, config);
    }
  }

  /**
   * 添加受影响的实体到上下文
   */
  private addAffectedEntity(context: CascadeContext, tableName: string, entity: Object): void {
    if (!context.affectedEntities.has(tableName)) {
      context.affectedEntities.set(tableName, []);
    }
    context.affectedEntities.get(tableName)!.push(entity);
  }

  /**
   * 检查是否应该级联
   */
  private shouldCascade(relation: RelationMapping, config: CascadeConfig, propertyKey?: string): boolean {
    if (!relation.cascade || relation.cascade.length === 0) {
      console.log(`关联 ${propertyKey || 'unknown'} 没有级联配置，跳过级联操作`);
      return false;
    }

    // 检查级联类型是否匹配
    const cascadeTypes = config.cascadeTypes;
    
    console.log(`检查级联配置 - 关联: ${propertyKey || 'unknown'}, 操作: ${config.operation}, 关联级联类型: ${JSON.stringify(relation.cascade)}, 配置级联类型: ${JSON.stringify(cascadeTypes)}`);

    const shouldCascade = cascadeTypes.some(type => {
      if (type === CascadeType.All) {
        return true;
      }

      return relation.cascade!.includes(type) ||
        (type === CascadeType.Create && config.operation === CascadeOperation.CREATE) ||
        (type === CascadeType.Update && config.operation === CascadeOperation.UPDATE) ||
        (type === CascadeType.Delete && config.operation === CascadeOperation.DELETE);
    });
    
    console.log(`级联检查结果: ${shouldCascade}`);
    return shouldCascade;
  }

  /**
   * 处理级联数组
   */
  private async processCascadeArray(entities: Object[], relation: RelationMapping, config: CascadeConfig, context: CascadeContext): Promise<void> {
    const batchSize = config.batchSize || 100;

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);

      // 顺序处理每个实体，确保外键正确设置
      for (const entity of batch) {
        await this.performCascadeOperation(entity, relation.targetClass, config, context);
      }
    }
  }

  /**
   * 处理级联关联
   */
  private async processCascadeRelation(parentEntity: Object, propertyKey: string, relation: RelationMapping, config: CascadeConfig, context: CascadeContext): Promise<void> {
    // 检查是否需要级联操作
    if (!this.shouldCascade(relation, config, propertyKey)) {
      return;
    }

    const relationValue = parentEntity[propertyKey];
    if (!relationValue) {
      return;
    }

    // 获取父实体的关联键值（使用装饰器中定义的localKey，如果没有则使用主键）
    const localKey = relation.localKey || this.getPrimaryKey(parentEntity);
    const parentKeyValue = parentEntity[localKey];
    
    console.info('ibest-orm', `处理级联关联 ${propertyKey}: localKey=${localKey}, parentKeyValue=${parentKeyValue}`);
    console.info('ibest-orm', `关联数据详情: ${JSON.stringify(relationValue)}`);
    
    // 如果父实体还没有主键值，说明还没有被创建，这不应该发生
    if (!parentKeyValue && (relation.type === 'hasOne' || relation.type === 'hasMany')) {
      console.error('ibest-orm', `父实体缺少主键值，无法设置外键关联: ${propertyKey}`);
      return;
    }

    try {
      if (Array.isArray(relationValue)) {
        // 处理一对多或多对多关联
        if (relation.type === 'manyToMany') {
          // 多对多关联处理
          if (config.operation === CascadeOperation.UPDATE) {
            // 更新操作：先删除现有关联，再重新建立关联
            await this.updateManyToManyRelations(parentEntity, relationValue, relation, parentKeyValue, config, context);
          } else {
            // 创建操作：先创建关联实体，然后插入关联表数据
            await this.processCascadeArray(relationValue, relation, config, context);
            await this.insertManyToManyRelations(parentKeyValue, relationValue, relation);
          }
        } else {
          // 一对多关联处理
          if (config.operation === CascadeOperation.UPDATE) {
            await this.updateOneToManyRelations(parentEntity, relationValue, relation, parentKeyValue, config, context);
          } else {
            // 创建操作：为每个子实体设置外键
            relationValue.forEach(childEntity => {
              this.setForeignKey(childEntity, relation, parentKeyValue);
            });
            await this.processCascadeArray(relationValue, relation, config, context);
          }
        }
      } else {
        // 处理一对一或多对一关联
        if (config.operation === CascadeOperation.UPDATE) {
          await this.updateOneToOneRelation(parentEntity, relationValue, relation, parentKeyValue, config, context);
        } else {
          // 创建操作：设置外键并执行级联操作
          this.setForeignKey(relationValue, relation, parentKeyValue);
          await this.performCascadeOperation(relationValue, relation.targetClass, config, context);
        }
      }
    } catch (error) {
      context.errors.push({
        entity: parentEntity,
        relation: propertyKey,
        operation: config.operation,
        error: error as Error,
        rollbackRequired: config.rollbackOnError || false
      });
    }
  }

  private getPrimaryKey(entity: Object) {
    const meta = GetColumnMeta(entity.constructor as Class);
    let primaryKey = "id";
    for (let i = 0; i < meta.length; i++) {
      if(meta[i].tag?.includes('primaryKey')) {
        primaryKey = meta[i].name!;
        break;
      }
    }
    return primaryKey;
  }

  /**
   * 设置外键关联
   */
  private setForeignKey(childEntity: Object, relation: RelationMapping, parentId: number): void {
    if (relation.foreignKey && parentId) {
      childEntity[relation.foreignKey] = parentId;
      console.info('ibest-orm', `设置外键: ${relation.foreignKey} = ${parentId} 到实体:`, JSON.stringify(childEntity));
    }
  }

  /**
   * 更新一对一关联
   */
  private async updateOneToOneRelation(parentEntity: Object, relationEntity: Object, relation: RelationMapping, parentId: number, config: CascadeConfig, context: CascadeContext): Promise<void> {
    console.log(`开始更新一对一关联: ${relation.foreignKey || 'unknown'}, 父实体ID: ${parentId}`);
    
    try {
      const result = this.saveOrUpdateEntity(relationEntity, relation.targetClass, parentId, relation);
      this.addAffectedEntity(context, GetTableName(relation.targetClass), relationEntity);
      console.log(`保存/更新一对一关联实体成功: ${relation.targetClass.name}, 结果: ${result}`);
    } catch (error) {
      console.error(`保存/更新一对一关联实体失败: ${relation.targetClass.name}`, error);
      context.errors.push({
        entity: relationEntity,
        relation: relation.foreignKey || 'oneToOne',
        operation: config.operation,
        error: error as Error,
        rollbackRequired: false
      });
    }
    
    console.log(`一对一关联更新完成`);
  }

  /**
   * 更新一对多关联
   */
  private async updateOneToManyRelations(parentEntity: Object, relationEntities: Object[], relation: RelationMapping, parentId: number, config: CascadeConfig, context: CascadeContext): Promise<void> {
    console.log(`开始更新一对多关联: ${relation.foreignKey}, 父实体ID: ${parentId}`);
    
    // 处理每个关联实体：有主键的更新，无主键的插入
    for (const childEntity of relationEntities) {
      try {
        const result = this.saveOrUpdateEntity(childEntity, relation.targetClass, parentId, relation, config.operation);
        this.addAffectedEntity(context, GetTableName(relation.targetClass), childEntity);
        console.log(`保存/更新关联实体成功: ${relation.targetClass.name}, 结果: ${result}`);
      } catch (error) {
        console.error(`保存/更新关联实体失败: ${relation.targetClass.name}`, error);
        context.errors.push({
          entity: childEntity,
          relation: relation.foreignKey,
          operation: config.operation,
          error: error as Error,
          rollbackRequired: false
        });
      }
    }
    
    console.log(`一对多关联更新完成，处理了 ${relationEntities.length} 个关联实体`);
  }

  /**
   * 更新多对多关联
   */
  private async updateManyToManyRelations(parentEntity: Object, relationEntities: Object[], relation: RelationMapping, parentId: number, config: CascadeConfig, context: CascadeContext): Promise<void> {
    if (!relation.through) {
      console.error('多对多关联配置不完整:', relation);
      return;
    }

    console.log(`开始更新多对多关联, 父实体ID: ${parentId}`);

    // 处理每个关联实体：有主键的更新，无主键的插入
    const processedEntities = [];
    for (const childEntity of relationEntities) {
      try {
        const result = await this.saveOrUpdateEntity(childEntity, relation.targetClass, parentId, relation, config.operation);
        this.addAffectedEntity(context, GetTableName(relation.targetClass), childEntity);
        console.log(`保存/更新关联实体成功: ${relation.targetClass.name}, 结果: ${result}`);
        
        // 确保实体有主键值用于关联表插入
        const primaryKey = this.getPrimaryKey(childEntity);
        if (!childEntity[primaryKey] && result > 0) {
          childEntity[primaryKey] = result;
        }
        processedEntities.push(childEntity);
      } catch (error) {
        console.error(`保存/更新关联实体失败: ${relation.targetClass.name}`, error);
        context.errors.push({
          entity: childEntity,
          relation: 'manyToMany',
          operation: config.operation,
          error: error as Error,
          rollbackRequired: false
        });
      }
    }

    // 重新建立关联关系（只为成功处理的实体建立关联）
    if (processedEntities.length > 0) {
      await this.insertManyToManyRelations(parentId, processedEntities, relation);
    }
    
    console.log(`多对多关联更新完成，处理了 ${processedEntities.length} 个关联实体`);
  }

  /**
   * 插入多对多关联表数据
   */
  private async insertManyToManyRelations(parentId: number, relationEntities: Object[], relation: RelationMapping): Promise<void> {
    if (!relation.through) {
      console.error('多对多关联配置不完整:', relation);
      return;
    }

    const throughTable = relation.through.table;
    const parentForeignKey = relation.through.foreignKey;
    const childForeignKey = relation.through.otherKey;

    console.log(`准备插入多对多关联表数据: ${throughTable}`);
    console.log(`父实体ID: ${parentId}, 父外键: ${parentForeignKey}, 子外键: ${childForeignKey}`);

    for (const childEntity of relationEntities) {
      const childId = childEntity[this.getPrimaryKey(childEntity)];
      
      if (childId) {
        // 检查关联是否已存在
        const existingRelation = this.orm.Table(throughTable)
          .Where(parentForeignKey, parentId)
          .Where(childForeignKey, childId)
          .First();

        console.log(`检查关联关系: ${parentForeignKey}=${parentId}, ${childForeignKey}=${childId}`);
        console.log(`现有关联关系:`, JSON.stringify(existingRelation));

        if (!existingRelation || Object.keys(existingRelation).length === 0) {
          // 插入关联表数据
          const relationData = {};
          relationData[parentForeignKey] = parentId;
          relationData[childForeignKey] = childId;

          console.log(`插入关联表数据:`, JSON.stringify(relationData));
          const insertResult = this.orm.Table(throughTable).Insert(relationData);
          console.log(`插入结果:`, insertResult);
        } else {
          console.log(`关联关系已存在: ${parentForeignKey}=${parentId}, ${childForeignKey}=${childId}`);
        }
      } else {
        console.error('子实体缺少主键值:', childEntity);
      }
    }
  }

  /**
   * 推断子外键名称
   */
  private inferChildForeignKey(throughTable: string, parentForeignKey: string, targetClass: Class): string {
    // 获取目标实体的表名
    const targetTableName = GetTableName(targetClass);
    
    // 根据表名推断外键名称，例如：roles -> role_id
    const singularName = targetTableName.endsWith('s') ? targetTableName.slice(0, -1) : targetTableName;
    return `${singularName}_id`;
  }

  /**
   * 验证级联操作
   */
  public validateCascadeOperation(entity: Object, entityClass: Class, config: CascadeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查实体是否为空
    if (!entity) {
      errors.push('Entity cannot be null or undefined');
    }

    // 检查实体类是否为空
    if (!entityClass) {
      errors.push('Entity class cannot be null or undefined');
    }

    // 检查最大深度
    if (config.maxDepth && config.maxDepth < 1) {
      errors.push('Max depth must be greater than 0');
    }

    // 检查批次大小
    if (config.batchSize && config.batchSize < 1) {
      errors.push('Batch size must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取级联操作统计信息
   */
  public async getCascadeStats(entityClass: Class): Promise<{
    totalRelations: number;
    cascadeRelations: number;
    maxDepth: number;
  }> {
    const relations = this.relationManager.getRelationMappings(entityClass);
    const cascadeRelations = relations ? Array.from(relations.values())
      .filter(relation => relation.cascade && relation.cascade.length > 0) : [];

    return {
      totalRelations: relations ? relations.size : 0,
      cascadeRelations: cascadeRelations.length,
      maxDepth: this.calculateMaxDepth(entityClass, new Set())
    };
  }

  /**
   * 计算最大级联深度
   */
  private calculateMaxDepth(entityClass: Class, visited: Set<Class>): number {
    if (visited.has(entityClass)) {
      return 0; // 避免循环引用
    }

    visited.add(entityClass);
    const relations = this.relationManager.getRelationMappings(entityClass);
    let maxDepth = 0;

    if (relations) {
      for (const relation of relations.values()) {
        if (relation.cascade && relation.cascade.length > 0) {
          const depth = 1 + this.calculateMaxDepth(relation.targetClass, new Set(visited));
          maxDepth = Math.max(maxDepth, depth);
        }
      }
    }

    return maxDepth;
  }
}

/**
 * 级联操作装饰器
 */
export function Cascade(config: Partial<CascadeConfig> = {}) {
  return function (target: AnyType, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cascadeManager = CascadeManager.getInstance();

      // 这里可以根据方法名自动判断操作类型
      const operation = propertyKey.includes('create') ? CascadeOperation.CREATE :
        propertyKey.includes('update') ? CascadeOperation.UPDATE :
          propertyKey.includes('delete') ? CascadeOperation.DELETE :
          CascadeOperation.SAVE;

      const mergedConfig: CascadeConfig = {
        ...cascadeManager.getDefaultConfig(),
        ...config,
        operation
      };

      if (args.length > 0 && args[0]) {
        return cascadeManager.cascadeSave(args[0], target.constructor, mergedConfig);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}