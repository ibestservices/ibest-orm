/**
 * @Column 装饰器
 */

import { Class, ColumnType } from '../types';
import { metadataStorage, ColumnMetadata } from '../types/metadata';
import { propertyToColumn } from '../utils';

/**
 * 列配置选项
 */
export interface ColumnOptions {
  name?: string;
  type?: ColumnType;
  notNull?: boolean;
  defaultValue?: unknown;
}

/**
 * @Column 装饰器
 * 支持两种用法：
 * 1. @Column() - 自动推断
 * 2. @Column({ type: ColumnType.TEXT }) - 显式配置
 */
export function Column(options?: ColumnOptions): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const constructor = target.constructor as Class;
    const key = String(propertyKey);
    const opts = options || {};

    const metadata: ColumnMetadata = {
      propertyKey: key,
      name: opts.name || propertyToColumn(key),
      type: opts.type || inferColumnType(constructor, key),
      isPrimaryKey: false,
      isAutoIncrement: false,
      isNotNull: opts.notNull ?? false,
      isAutoCreateTime: false,
      isAutoUpdateTime: false,
      isSoftDelete: false,
      defaultValue: opts.defaultValue
    };

    // 应用 @NotNull 装饰器标记
    metadataStorage.applyPendingNotNull(constructor, key, metadata);
    metadataStorage.addColumnMetadata(constructor, metadata);
  };
}

/**
 * @PrimaryKey 装饰器
 */
export function PrimaryKey(options?: { autoIncrement?: boolean }): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const constructor = target.constructor as Class;
    const key = String(propertyKey);
    const opts = options || {};

    const metadata: ColumnMetadata = {
      propertyKey: key,
      name: propertyToColumn(key),
      type: ColumnType.INTEGER,
      isPrimaryKey: true,
      isAutoIncrement: opts.autoIncrement ?? true,
      isNotNull: true,
      isAutoCreateTime: false,
      isAutoUpdateTime: false,
      isSoftDelete: false
    };

    metadataStorage.addColumnMetadata(constructor, metadata);
  };
}

/**
 * @CreatedAt 装饰器
 */
export function CreatedAt(options?: { name?: string }): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const constructor = target.constructor as Class;
    const key = String(propertyKey);

    const metadata: ColumnMetadata = {
      propertyKey: key,
      name: options?.name || 'created_at',
      type: ColumnType.TEXT,
      isPrimaryKey: false,
      isAutoIncrement: false,
      isNotNull: true,
      isAutoCreateTime: true,
      isAutoUpdateTime: false,
      isSoftDelete: false
    };

    metadataStorage.addColumnMetadata(constructor, metadata);
  };
}

/**
 * @UpdatedAt 装饰器
 */
export function UpdatedAt(options?: { name?: string }): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const constructor = target.constructor as Class;
    const key = String(propertyKey);

    const metadata: ColumnMetadata = {
      propertyKey: key,
      name: options?.name || 'updated_at',
      type: ColumnType.TEXT,
      isPrimaryKey: false,
      isAutoIncrement: false,
      isNotNull: true,
      isAutoCreateTime: false,
      isAutoUpdateTime: true,
      isSoftDelete: false
    };

    metadataStorage.addColumnMetadata(constructor, metadata);
  };
}

/**
 * @SoftDelete 装饰器
 * 标记软删除字段，默认字段名为 deleted_at
 */
export function SoftDelete(options?: { name?: string }): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const constructor = target.constructor as Class;
    const key = String(propertyKey);

    const metadata: ColumnMetadata = {
      propertyKey: key,
      name: options?.name || 'deleted_at',
      type: ColumnType.TEXT,
      isPrimaryKey: false,
      isAutoIncrement: false,
      isNotNull: false,
      isAutoCreateTime: false,
      isAutoUpdateTime: false,
      isSoftDelete: true
    };

    metadataStorage.addColumnMetadata(constructor, metadata);
  };
}

/**
 * @NotNull 装饰器
 * 标记字段为非空（替代 ! 修饰符的运行时方案）
 */
export function NotNull(): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const constructor = target.constructor as Class;
    const key = String(propertyKey);
    metadataStorage.markColumnNotNull(constructor, key);
  };
}

/**
 * 推断列类型（基于属性名约定）
 */
function inferColumnType(target: Class, propertyKey: string): ColumnType {
  const lowerKey = propertyKey.toLowerCase();

  // 常见整数字段
  if (lowerKey === 'id' || lowerKey.endsWith('id') || lowerKey.endsWith('count') ||
      lowerKey === 'age' || lowerKey === 'status' || lowerKey === 'level') {
    return ColumnType.INTEGER;
  }

  // 常见浮点字段
  if (lowerKey.includes('price') || lowerKey.includes('amount') ||
      lowerKey.includes('rate') || lowerKey.includes('score')) {
    return ColumnType.REAL;
  }

  // 默认文本
  return ColumnType.TEXT;
}
