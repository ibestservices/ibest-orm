/**
 * 关联装饰器
 */

import { Class, RelationType, CascadeType } from '../types';
import { metadataStorage, RelationMetadata } from '../types/metadata';
import { propertyToColumn } from '../utils';

/**
 * 关联配置选项
 */
export interface RelationOptions {
  foreignKey?: string;
  localKey?: string;
  cascade?: CascadeType[];
  lazy?: boolean;
}

/**
 * 多对多关联配置
 */
export interface ManyToManyOptions extends RelationOptions {
  through: string | Class;
  throughForeignKey?: string;
  throughOtherKey?: string;
}

/**
 * @HasOne 装饰器 - 一对一关联
 */
export function HasOne(target: Class | (() => Class), options?: RelationOptions): PropertyDecorator {
  return createRelationDecorator(RelationType.HasOne, target, options);
}

/**
 * @HasMany 装饰器 - 一对多关联
 */
export function HasMany(target: Class | (() => Class), options?: RelationOptions): PropertyDecorator {
  return createRelationDecorator(RelationType.HasMany, target, options);
}

/**
 * @BelongsTo 装饰器 - 多对一关联
 */
export function BelongsTo(target: Class | (() => Class), options?: RelationOptions): PropertyDecorator {
  return createRelationDecorator(RelationType.BelongsTo, target, options);
}

/**
 * @ManyToMany 装饰器 - 多对多关联
 */
export function ManyToMany(target: Class | (() => Class), options: ManyToManyOptions): PropertyDecorator {
  return function (targetObj: Object, propertyKey: string | symbol) {
    const constructor = targetObj.constructor as Class;
    const key = String(propertyKey);

    const metadata: RelationMetadata = {
      propertyKey: key,
      type: RelationType.ManyToMany,
      target,
      foreignKey: options.foreignKey,
      localKey: options.localKey || 'id',
      through: options.through,
      throughForeignKey: options.throughForeignKey,
      throughOtherKey: options.throughOtherKey,
      cascade: options.cascade,
      lazy: options.lazy ?? true
    };

    metadataStorage.addRelationMetadata(constructor, metadata);
  };
}

/**
 * 创建关联装饰器
 */
function createRelationDecorator(
  type: RelationType,
  target: Class | (() => Class),
  options?: RelationOptions
): PropertyDecorator {
  return function (targetObj: Object, propertyKey: string | symbol) {
    const constructor = targetObj.constructor as Class;
    const key = String(propertyKey);
    const opts = options || {};

    // 自动推断外键名
    let foreignKey = opts.foreignKey;
    if (!foreignKey) {
      if (type === RelationType.BelongsTo) {
        foreignKey = propertyToColumn(key) + '_id';
      } else {
        foreignKey = propertyToColumn(constructor.name) + '_id';
      }
    }

    const metadata: RelationMetadata = {
      propertyKey: key,
      type,
      target,
      foreignKey,
      localKey: opts.localKey || 'id',
      cascade: opts.cascade,
      lazy: opts.lazy ?? true
    };

    metadataStorage.addRelationMetadata(constructor, metadata);
  };
}
