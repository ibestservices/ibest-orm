/**
 * @Table 装饰器
 */

import { Class, ColumnType } from '../types';
import { metadataStorage, TableMetadata, ColumnMetadata } from '../types/metadata';
import { classToTable } from '../utils';

/**
 * 表配置选项
 */
export interface TableOptions {
  name?: string;
}

/**
 * @Table 装饰器
 * 用法: @Table() 或 @Table({ name: 'custom_name' })
 */
export function Table(options?: TableOptions): ClassDecorator {
  return function (target: Function): void {
    registerTable(target as Class, options || {});
  };
}

function registerTable(target: Class, options: TableOptions): void {
  const tableName = options.name || classToTable(target.name);

  const metadata: TableMetadata = {
    name: tableName,
    className: target.name
  };

  metadataStorage.setTableMetadata(target, metadata);

  // 自动识别 id 字段为主键
  autoDetectPrimaryKey(target);
}

/**
 * 自动检测 id 字段作为主键
 */
function autoDetectPrimaryKey(target: Class): void {
  const entity = metadataStorage.getEntityMetadata(target);
  if (!entity) return;

  // 如果已有主键，跳过
  if (entity.primaryKey) return;

  // 查找 id 字段
  const idColumn = entity.columns.find(c => c.propertyKey === 'id');
  if (idColumn) {
    // 将 id 字段设为主键
    idColumn.isPrimaryKey = true;
    idColumn.isAutoIncrement = true;
    idColumn.type = ColumnType.INTEGER;
    entity.primaryKey = idColumn;
  }
}
