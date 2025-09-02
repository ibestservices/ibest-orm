/**
 * 延迟加载实现
 * 提供简洁的延迟加载API
 */

import { Class, GetColumnMeta, GetTableName } from '../decorator/Index';
import { RelationConfig, RelationType } from '../decorator/Relation';
import { IBestORM } from './SQLiteORM';
import { relationalStore } from '@kit.ArkData';

/**
 * 延迟加载状态枚举
 */
export enum LazyLoadState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error'
}

/**
 * 延迟加载代理对象
 */
export class LazyLoadProxy {
  private _target: Object;
  private _entityClass: Class;
  private _orm: IBestORM;
  private _loadedRelations: Map<string, (Record<string, relationalStore.ValueType>|Record<string, relationalStore.ValueType>[]|null)> = new Map();

  constructor(target: Object, entityClass: Class, orm: IBestORM) {
    this._target = target;
    this._entityClass = entityClass;
    this._orm = orm;
  }

  /**
   * 获取原始目标对象
   */
  getTarget(): Object {
    return this._target;
  }

  /**
   * 获取实体类
   */
  getEntityClass(): Class {
    return this._entityClass;
  }

  /**
   * 检查关联是否已加载
   */
  isRelationLoaded(relationName: string): boolean {
    return this._loadedRelations.has(relationName);
  }

  /**
   * 获取已加载的关联数据
   */
  getLoadedRelation(relationName: string): Record<string, relationalStore.ValueType> | Record<string, relationalStore.ValueType>[] | undefined {
    return this._loadedRelations.get(relationName);
  }

  /**
   * 设置已加载的关联数据
   */
  setLoadedRelation(relationName: string, data: Record<string, relationalStore.ValueType> | Record<string, relationalStore.ValueType>[] | null): void {
    if (data !== null) {
      this._loadedRelations.set(relationName, data);
    }
  }

  /**
   * 清除已加载的关联数据
   */
  clearLoadedRelation(relationName: string): boolean {
    return this._loadedRelations.delete(relationName);
  }

  /**
   * 清除所有已加载的关联数据
   */
  clearAllLoadedRelations(): void {
    this._loadedRelations.clear();
  }
}

/**
 * 延迟加载管理器
 */
export class LazyLoadManager {
  private orm: IBestORM;
  private cache: Map<string, (Record<string, relationalStore.ValueType>|Record<string, relationalStore.ValueType>[]|null)> = new Map();

  constructor(orm: IBestORM) {
    this.orm = orm;
  }

  /**
   * 创建延迟加载代理
   */
  createProxy(entity: Object, entityClass: Class): LazyLoadProxy {
    return new LazyLoadProxy(entity, entityClass, this.orm);
  }

  /**
   * 加载关联数据（同步方法）
   * 如果已加载则直接返回缓存，否则立即加载并缓存
   */
  loadRelation(proxy: LazyLoadProxy, relationName: string, force: boolean = false): Record<string, relationalStore.ValueType> | Record<string, relationalStore.ValueType>[] | null {
    // 如果已加载且不强制重新加载，直接返回缓存
    if (!force && proxy.isRelationLoaded(relationName)) {
      return proxy.getLoadedRelation(relationName);
    }

    // 获取关联配置
    const relationConfig = this.getRelationConfig(proxy.getEntityClass(), relationName);
    if (!relationConfig) {
      throw new Error(`关联 '${relationName}' 在实体 '${proxy.getEntityClass().name}' 中未找到`);
    }

    try {
      // 执行同步加载
      const result = this.performLoad(proxy, relationConfig);
      // 缓存结果
      proxy.setLoadedRelation(relationName, result);
      return result;
    } catch (error) {
      console.error(`加载关联 '${relationName}' 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取关联配置
   */
  private getRelationConfig(entityClass: Class, relationName: string): RelationConfig | null {
    const relationMeta = entityClass.__RelationMeta__ || [];
    return relationMeta.find((config: RelationConfig) => config.propertyKey === relationName) || null;
  }

  /**
   * 解析目标类
   */
  private resolveTargetClass(target: Class | (() => Class)): Class {
    return typeof target === 'function' && target.length === 0 ? (target as () => Class)() : target as Class;
  }

  /**
   * 执行实际的数据加载
   */
  private performLoad(proxy: LazyLoadProxy, relationConfig: RelationConfig): Record<string, relationalStore.ValueType>[] | Record<string, relationalStore.ValueType> | null {
    const target = proxy.getTarget();
    const targetClass = this.resolveTargetClass(relationConfig.target);
    const tableName = GetTableName(targetClass);

    switch (relationConfig.type) {
      case RelationType.HasOne:
        return this.loadHasOne(target, relationConfig, tableName);

      case RelationType.HasMany:
        return this.loadHasMany(target, relationConfig, tableName);

      case RelationType.BelongsTo:
        return this.loadBelongsTo(target, relationConfig, tableName);

      case RelationType.ManyToMany:
        return this.loadManyToMany(target, relationConfig, tableName);

      default:
        throw new Error(`不支持的关联类型: ${relationConfig.type}`);
    }
  }

  private getPropertyKeyByFieldName(model: Object, field_name: string) {
    const meta = GetColumnMeta(model.constructor as Class);
    let PropertyKey = 'id';
    for (let i = 0; i < meta.length; i++) {
      const name = meta[i].name!
      if(name == field_name) {
        PropertyKey = meta[i].propertyKey!
        break;
      }
    }
    return PropertyKey;
  }

  /**
   * 加载HasOne关联
   */
  private loadHasOne(entity: Object, config: RelationConfig, tableName: string): Record<string, relationalStore.ValueType> | null {
    const propertyKey = this.getPropertyKeyByFieldName(entity, config.localKey);
    const localValue = entity[propertyKey || 'id'];
    if (!localValue) {
      return null;
    }

    const result = this.orm.Table(tableName)
      .Where(config.foreignKey!, localValue)
      .First();

    console.log("##loadHasOne##", "ret:", JSON.stringify(result))
    
    return result || null;
  }

  /**
   * 加载HasMany关联
   */
  private loadHasMany(entity: Object, config: RelationConfig, tableName: string): Record<string, relationalStore.ValueType>[] {
    const propertyKey = this.getPropertyKeyByFieldName(entity, config.localKey);
    const localValue = entity[propertyKey || 'id'];

    if (!localValue) {
      return [];
    }

    const result = this.orm.Table(tableName)
      .Where(config.foreignKey!, localValue)
      .Find();

    console.log("##loadHasMany##", "ret:", JSON.stringify(result))
    
    return result || [];
  }

  /**
   * 加载BelongsTo关联
   */
  private loadBelongsTo(entity: Object, config: RelationConfig, tableName: string): Record<string, relationalStore.ValueType> | null {
    const propertyKey = this.getPropertyKeyByFieldName(entity, config.foreignKey!);
    const foreignValue = entity[propertyKey];
    if (!foreignValue) {
      return null;
    }

    const result = this.orm.Table(tableName)
      .Where(config.localKey || 'id', foreignValue)
      .First();
    
    return result || null;
  }

  /**
   * 加载ManyToMany关联
   */
  private loadManyToMany(entity: Object, config: RelationConfig, tableName: string): Record<string, relationalStore.ValueType>[] {
    if (!config.through) {
      throw new Error('ManyToMany关联需要through表');
    }

    const propertyKey = this.getPropertyKeyByFieldName(entity, config.localKey);
    const localValue = entity[propertyKey || 'id'];
    if (!localValue) {
      return [];
    }

    const throughTable = typeof config.through === 'string' ? config.through : GetTableName(config.through);

    // 构建多对多查询SQL
    const sql = `
      SELECT t.*
      FROM ${tableName} t
      INNER JOIN ${throughTable} mt ON t.${config.localKey || 'id'} = mt.${config.throughOtherKey}
      WHERE mt.${config.throughForeignKey} = ?
    `;

    try {
      let resultData: Array<Record<string, relationalStore.ValueType>> = [];
      let resultSet = this.orm.GetCore()?.querySqlSync(sql, [localValue]);

      if (resultSet && resultSet.rowCount > 0) {
        if (resultSet.goToFirstRow()) {
          while (!resultSet.isEnded) {
            let model: Record<string, relationalStore.ValueType> = {};
            for (let i = 0; i < resultSet.columnNames.length; i++) {
              let columnName = resultSet.columnNames[i];
              model[columnName] = resultSet.getValue(resultSet.getColumnIndex(columnName));
            }
            resultData.push(model);
            resultSet.goToNextRow();
          }
        }
        resultSet.close();
      }

      return resultData;
    } catch (error) {
      console.error('多对多关联查询失败:', error);
      return [];
    }
  }

  /**
   * 预加载关联数据（支持单个或多个）
   */
  async preloadRelation(proxy: LazyLoadProxy, relationName: string | string[]): Promise<void> {
    if (Array.isArray(relationName)) {
      // 批量预加载
      const promises = relationName.map(name => this.preloadSingleRelation(proxy, name));
      await Promise.allSettled(promises);
    } else {
      // 单个预加载
      await this.preloadSingleRelation(proxy, relationName);
    }
  }

  /**
   * 预加载单个关联数据（内部方法）
   */
  private async preloadSingleRelation(proxy: LazyLoadProxy, relationName: string): Promise<void> {
    try {
      this.loadRelation(proxy, relationName);
    } catch (error) {
      // 预加载失败时静默处理
      console.warn(`预加载关联 '${relationName}' 失败:`, error);
    }
  }

  /**
   * 重新加载关联数据（支持单个或多个）
   */
  reloadRelation(proxy: LazyLoadProxy, relationName: string | string[]) {
    if (Array.isArray(relationName)) {
      // 批量重新加载
      const results: Array<Record<string, relationalStore.ValueType> | Record<string, relationalStore.ValueType>[] | null> = [];
      for (const name of relationName) {
        proxy.clearLoadedRelation(name);
        const result = this.loadRelation(proxy, name, true);
        results.push(result);
      }
      return results;
    } else {
      // 单个重新加载
      proxy.clearLoadedRelation(relationName);
      return this.loadRelation(proxy, relationName, true);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}