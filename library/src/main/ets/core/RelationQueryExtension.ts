import { IBestORM } from "./SQLiteORM";
import { Class, GetTableName } from "../decorator/Index";
import { RelationQueryBuilder } from "./RelationQueryBuilder";
import { getMetadataCollector } from "./MetadataCollector";
import { RelationWrapper, RelationQueryResult } from "./RelationTypes";
import { relationalStore } from '@kit.ArkData';

/**
 * 关联查询扩展
 * 为IBestORM添加关联查询功能
 */
export class RelationQueryExtension {
  private orm: IBestORM;
  private relationBuilder: RelationQueryBuilder | null = null;
  private currentEntityClass: Class | null = null;

  constructor(orm: IBestORM) {
    this.orm = orm;
  }

  /**
   * 设置当前查询的实体类
   */
  setEntityClass(entityClass: Class): this {
    this.currentEntityClass = entityClass;
    this.relationBuilder = new RelationQueryBuilder(entityClass);

    // 确保实体已注册
    const collector = getMetadataCollector();
    collector.collect(entityClass);

    return this;
  }

  /**
   * 预加载关联数据
   */
  with(relations: string | string[]): this {
    if (!this.relationBuilder) {
      throw new Error('请先调用Session()方法设置实体类');
    }

    this.relationBuilder.preload(relations);
    return this;
  }

  /**
   * 预加载关联数据（别名方法）
   */
  preload(relations: string | string[]): this {
    return this.with(relations);
  }

  /**
   * 执行关联查询并返回第一条记录
   */
  async firstWithRelations(ref?: Object): Promise<Record<string, relationalStore.ValueType> | null> {
    if (!this.relationBuilder || !this.currentEntityClass) {
      throw new Error('请先调用Session()方法设置实体类');
    }

    console.log('firstWithRelations 开始执行...');
    
    // 执行主查询
    const mainResult = this.orm.First(ref);
    console.log('主查询结果:', JSON.stringify(mainResult, null, 2));
    
    if (!mainResult || Object.keys(mainResult).length === 0) {
      console.log('主查询无结果，返回null');
      return null;
    }

    // 加载关联数据
    const resultWithRelations = await this.loadRelations([mainResult]);
    console.log('加载关联后的结果:', JSON.stringify(resultWithRelations, null, 2));
    
    const finalResult = resultWithRelations.length > 0 ? resultWithRelations[0] : null;
    console.log('最终返回结果:', JSON.stringify(finalResult, null, 2));
    
    return finalResult;
  }

  /**
   * 执行关联查询并返回所有记录
   */
  async findWithRelations(): Promise<Record<string, relationalStore.ValueType>[]> {
    if (!this.relationBuilder || !this.currentEntityClass) {
      throw new Error('请先调用Session()方法设置实体类');
    }

    // 执行主查询
    const mainResults = this.orm.Find();
    if (!mainResults || mainResults.length === 0) {
      return [];
    }

    // 加载关联数据
    return await this.loadRelations(mainResults);
  }

  /**
   * 加载关联数据
   */
  private async loadRelations(
    mainResults: Record<string, relationalStore.ValueType>[]
  ): Promise<Record<string, relationalStore.ValueType>[]> {
    if (!this.relationBuilder) {
      return mainResults;
    }

    const preloadRelations = this.relationBuilder.getPreloadRelations();
    console.log('预加载关联:', preloadRelations);
    
    if (preloadRelations.length === 0) {
      return mainResults;
    }

    const relationManager = getMetadataCollector().getRelationManager();
    const results = [...mainResults];

    // 为每个预加载关联执行查询
    for (const relationPath of preloadRelations) {
      try {
        console.log(`处理关联路径: ${relationPath}`);
        const relationMappings = relationManager.getRelationPath(this.currentEntityClass!, relationPath);
        await this.loadRelationData(results, relationMappings, relationPath);
      } catch (error) {
        console.error(`加载关联 ${relationPath} 失败:`, error);
      }
    }

    return results;
  }

  /**
   * 加载单个关联的数据
   */
  private async loadRelationData(
    results: Record<string, relationalStore.ValueType>[],
    relationMappings: any[],
    relationPath: string
  ): Promise<void> {
    if (relationMappings.length === 0) {
      return;
    }

    // 简单实现：只处理第一层关联
    const mapping = relationMappings[0];
    const relationData = new Map<any, any>();

    // 收集需要查询的键值
    const keyValues = new Set<any>();
    for (const result of results) {
      let keyValue: any;

      switch (mapping.type) {
        case 'hasOne':
        case 'hasMany':
          keyValue = result[mapping.localKey];
          break;
        case 'belongsTo':
          keyValue = result[mapping.foreignKey];
          break;
        case 'manyToMany':
          // 多对多关联需要特殊处理
          keyValue = result[mapping.localKey];
          break;
      }

      if (keyValue !== undefined && keyValue !== null) {
        keyValues.add(keyValue);
      }
    }

    if (keyValues.size === 0) {
      return;
    }

    // 执行关联查询
    const targetTableName = this.getTableName(mapping.targetClass);
    console.log(`目标类: ${mapping.targetClass.name}, 获取的表名: ${targetTableName}`);
    
    let relationResults: Record<string, relationalStore.ValueType>[] = [];

    switch (mapping.type) {
      case 'hasOne':
      case 'hasMany':
        const foreignKeyValues = Array.from(keyValues);
        console.log(`关联查询调试 - hasOne/hasMany: 表=${targetTableName}, 外键=${mapping.foreignKey}, 值=${JSON.stringify(foreignKeyValues)}`);
        relationResults = this.orm.Table(targetTableName)
          .Where(mapping.foreignKey, foreignKeyValues)
          .Find();
        console.log(`关联查询结果: ${JSON.stringify(relationResults)}`);
        break;

      case 'belongsTo':
        const localKeyValues = Array.from(keyValues);
        console.log(`关联查询调试 - belongsTo: 表=${targetTableName}, 本地键=${mapping.localKey}, 值=${JSON.stringify(localKeyValues)}`);
        relationResults = this.orm.Table(targetTableName)
          .Where(mapping.localKey, localKeyValues)
          .Find();
        console.log(`关联查询结果: ${JSON.stringify(relationResults)}`);
        break;

      case 'manyToMany':
        // 多对多关联通过中间表查询
        console.log(`关联查询调试 - manyToMany: 表=${targetTableName}}`);
        if (mapping.through) {
          relationResults = await this.queryManyToManyRelation(mapping, Array.from(keyValues));
        }
        break;
    }

    // 构建关联数据映射
    for (const relationResult of relationResults) {
      let key: any;

      switch (mapping.type) {
        case 'hasOne':
        case 'hasMany':
          key = relationResult[mapping.foreignKey];
          break;
        case 'belongsTo':
          key = relationResult[mapping.localKey];
          break;
        case 'manyToMany':
          key = relationResult['__parent_key__']; // 特殊标记
          // 移除辅助字段
          delete relationResult['__parent_key__'];
          break;
      }

      if (!relationData.has(key)) {
        relationData.set(key, mapping.type === 'hasMany' || mapping.type === 'manyToMany' ? [] : null);
      }

      if (mapping.type === 'hasMany' || mapping.type === 'manyToMany') {
        relationData.get(key).push(relationResult);
      } else {
        relationData.set(key, relationResult);
      }
    }

    // 将关联数据附加到主结果
    for (const result of results) {
      let keyValue: any;

      switch (mapping.type) {
        case 'hasOne':
        case 'hasMany':
          keyValue = result[mapping.localKey];
          break;
        case 'belongsTo':
          keyValue = result[mapping.foreignKey];
          break;
        case 'manyToMany':
          keyValue = result[mapping.localKey];
          break;
      }

      const relationValue = relationData.get(keyValue);
      if (relationValue !== undefined) {
        result[mapping.propertyKey] = relationValue;
      } else {
        // 设置默认值
        result[mapping.propertyKey] = mapping.type === 'hasMany' || mapping.type === 'manyToMany' ? [] : null;
      }
    }
  }

  /**
   * 查询多对多关联数据
   */
  private async queryManyToManyRelation(mapping: any, keyValues: any[]): Promise<Record<string, relationalStore.ValueType>[]> {
    if (!mapping.through) {
      return [];
    }

    const targetTableName = this.getTableName(mapping.targetClass);
    const throughTable = mapping.through.table;
    const foreignKey = mapping.through.foreignKey;
    const otherKey = mapping.through.otherKey;

    console.log(`多对多查询详情: 目标表=${targetTableName}, 关联表=${throughTable}, 外键=${foreignKey}, 其他键=${otherKey}`);
    console.log(`查询的键值:`, keyValues);

    // 构建多对多查询SQL - 修正JOIN条件
    const sql = `
      SELECT t.*, mt.${foreignKey} as __parent_key__
      FROM ${targetTableName} t
      INNER JOIN ${throughTable} mt ON t.id = mt.${otherKey}
      WHERE mt.${foreignKey} IN (${keyValues.map(() => '?').join(',')})
    `;

    console.log(`多对多查询SQL: ${sql}`);

    try {
      let resultData: Array<Record<string, relationalStore.ValueType>> = [];
      let resultSet = this.orm.GetCore()?.querySqlSync(sql, keyValues);
      
      console.log(`查询结果行数: ${resultSet?.rowCount || 0}`);
      
      if(resultSet && resultSet.rowCount > 0) {
        if (resultSet.goToFirstRow()) {
          while (!resultSet.isEnded) {
            let Model: Record<string, relationalStore.ValueType> = {}
            for (let i = 0; i < resultSet.columnNames.length; i++) {
              let value = resultSet.columnNames[i]
              Model[value] = resultSet.getValue(resultSet.getColumnIndex(value))
            }

            if (!resultData.includes(Model)) {
              resultData.push(Model)
            }
            resultSet.goToNextRow()
          }
        }
      }
      
      console.log(`多对多查询最终结果:`, JSON.stringify(resultData));
      return resultData;
    } catch (error) {
      console.error('多对多关联查询失败:', error);
      return [];
    }
  }

  /**
   * 获取表名
   */
  private getTableName(entityClass: Function): string {
    return GetTableName(entityClass as Class);
  }

  /**
   * 创建延迟加载包装器
   */
  createLazyWrapper<T>(loader: () => Promise<T>, isArray: boolean = false): RelationWrapper<T> {
    return new RelationWrapper<T>(loader, isArray);
  }

  /**
   * 清空关联查询配置
   */
  clearRelations(): this {
    if (this.relationBuilder) {
      this.relationBuilder.clear();
    }
    return this;
  }

  /**
   * 获取当前关联查询配置
   */
  getRelationConfig(): {
    preloadRelations: string[];
  } {
    if (!this.relationBuilder) {
      return { preloadRelations: [] };
    }

    return {
      preloadRelations: this.relationBuilder.getPreloadRelations()
    };
  }
}