import { AnyType } from "../model/Global.type";
import { Class } from "./Index";

/**
 * 关联类型枚举
 */
export enum RelationType {
  HasOne = 'hasOne',
  HasMany = 'hasMany',
  BelongsTo = 'belongsTo',
  ManyToMany = 'manyToMany'
}

/**
 * 级联操作类型
 */
export enum CascadeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  All = 'all'
}

/**
 * 关联配置接口
 */
export interface RelationConfig {
  /** 关联类型 */
  type: RelationType;
  /** 目标实体类 */
  target: Class | (() => Class);
  /** 外键字段名 */
  foreignKey?: string;
  /** 本地键字段名 */
  localKey?: string;
  /** 中间表（多对多关联） */
  through?: Class | string;
  /** 中间表外键（多对多关联） */
  throughForeignKey?: string;
  /** 中间表关联键（多对多关联） */
  throughOtherKey?: string;
  /** 级联操作 */
  cascade?: CascadeType[];
  /** 是否延迟加载 */
  lazy?: boolean;
  /** 关联属性名 */
  propertyKey?: string;
}

/**
 * 一对一关联装饰器
 * @param config 关联配置
 */
export const HasOne = (config: Omit<RelationConfig, 'type' | 'propertyKey'>) => {
  return (target: object, propertyKey: string) => {
    if (!target.constructor.__RelationMeta__) {
      target.constructor.__RelationMeta__ = [];
    }

    const relationConfig: RelationConfig = {
      ...config,
      type: RelationType.HasOne,
      propertyKey,
      lazy: config.lazy ?? true
    };

    target.constructor.__RelationMeta__.push(relationConfig);
  };
}

/**
 * 一对多关联装饰器
 * @param config 关联配置
 */
export const HasMany = (config: Omit<RelationConfig, 'type' | 'propertyKey'>) => {
  return (target: object, propertyKey: string) => {
    if (!target.constructor.__RelationMeta__) {
      target.constructor.__RelationMeta__ = [];
    }

    const relationConfig: RelationConfig = {
      ...config,
      type: RelationType.HasMany,
      propertyKey,
      lazy: config.lazy ?? true
    };

    target.constructor.__RelationMeta__.push(relationConfig);
  };
}

/**
 * 反向关联装饰器（多对一）
 * @param config 关联配置
 */
export const BelongsTo = (config: Omit<RelationConfig, 'type' | 'propertyKey'>) => {
  return (target: object, propertyKey: string) => {
    if (!target.constructor.__RelationMeta__) {
      target.constructor.__RelationMeta__ = [];
    }

    const relationConfig: RelationConfig = {
      ...config,
      type: RelationType.BelongsTo,
      propertyKey,
      lazy: config.lazy ?? true
    };

    target.constructor.__RelationMeta__.push(relationConfig);
  };
}

/**
 * 多对多关联装饰器
 * @param config 关联配置
 */
export const ManyToMany = (config: Omit<RelationConfig, 'type' | 'propertyKey'>) => {
  return (target: object, propertyKey: string) => {
    if (!target.constructor.__RelationMeta__) {
      target.constructor.__RelationMeta__ = [];
    }

    const relationConfig: RelationConfig = {
      ...config,
      type: RelationType.ManyToMany,
      propertyKey,
      lazy: config.lazy ?? true
    };

    target.constructor.__RelationMeta__.push(relationConfig);
  };
}