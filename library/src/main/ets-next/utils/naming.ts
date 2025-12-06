/**
 * 命名转换工具
 */

/**
 * 驼峰转蛇形
 * @example camelToSnake('createdAt') => 'created_at'
 * @example camelToSnake('ID') => 'id'
 * @example camelToSnake('userID') => 'user_id'
 */
export function camelToSnake(str: string): string {
  if (!str) return '';

  return str
    .replace(/^[A-Z]+$/, match => match.toLowerCase())
    .replace(/(?<!^)([A-Z])/g, '_$1')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * 蛇形转驼峰
 * @example snakeToCamel('created_at') => 'createdAt'
 */
export function snakeToCamel(str: string): string {
  if (!str) return '';

  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 首字母小写
 */
export function lowerFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * 首字母大写
 */
export function upperFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 类名转表名
 * @example classToTable('User') => 'user'
 * @example classToTable('UserProfile') => 'user_profile'
 */
export function classToTable(className: string): string {
  return camelToSnake(className);
}

/**
 * 属性名转字段名
 * @example propertyToColumn('createdAt') => 'created_at'
 */
export function propertyToColumn(propertyName: string): string {
  return camelToSnake(propertyName);
}
