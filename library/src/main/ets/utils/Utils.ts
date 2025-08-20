import { FieldParams } from "../decorator/Field";
import { FieldType } from "../model/Global.type";

/**
 * 将驼峰命名（如 CreatedAt、ID）转换为蛇形命名（如 created_at、id）
 * @param camelCase 驼峰命名的字符串
 * @returns 蛇形命名的字符串
 */
export function camelToSnakeCase(camelCase: string): string {
  if (!camelCase) return '';

  // 处理连续大写字母的情况，在小写字母前的大写字母前插入下划线
  const snakeCase = camelCase
      // 纯大写字母（如 ID → id，UUID → uuid）
    .replace(/^[A-Z]+$/, match => match.toLowerCase())
      // 处理一般驼峰：在非首字母的大写字母前插入下划线（如 CreatedAt → Created_At）
    .replace(/(?<!^)([A-Z])/g, '_$1')
      // 处理连续大写后接小写的情况（如 IDCard → ID_Card → 最终 id_card）
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      // 全部转为小写
    .toLowerCase();

  return snakeCase;
}

export function createTableSQLByMeta(tableName: string, meta: FieldParams[]): string {
  let fields: string[] = [];
  for (let i = 0; i < meta.length; i++) {
    const item = meta[i];
    const fieldType = item.type;
    const name = item.name!;
    const tag = item.tag ? item.tag: [];
    const isNotNull = tag.includes('notNull') ? "NOT NULL" : "";
    const isPrimaryKey = tag.includes('primaryKey') ? "PRIMARY KEY" : "";
    const autoIncrement = (fieldType == FieldType.INTEGER && tag.includes('autoIncrement')) ? "AUTOINCREMENT" : "";
    let sqlStr = `${name} ${fieldType} ${isNotNull} ${isPrimaryKey} ${autoIncrement}`;
    if(fieldType == FieldType.TEXT && (tag.includes('autoCreateTime') || tag.includes('autoUpdateTime'))) {
      sqlStr += ` DEFAULT (DATETIME('now', 'localtime'))`;
    }
    fields.push(sqlStr);
  }

  return `CREATE TABLE IF NOT EXISTS ${tableName} (${fields.join(', ')});`;
}

export function formatCastExpressions(fields: string[], types: FieldType[]): string {
  // 校验两个数组长度是否一致
  if (fields.length !== types.length) {
    throw new Error('字段名数组与类型数组长度必须一致');
  }

  // 遍历数组生成CAST表达式
  const castExpressions = fields.map((field, index) => {
    const type = types[index];
    return `CAST(${field} AS ${type})`;
  });

  // 拼接成逗号分隔的字符串
  return castExpressions.join(', ');
}

export function getLocalTimeString(): string {
  const date = new Date(); // 基于系统时区的当前时间

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 月份从0开始，+1后为实际月份
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  // 补零函数：确保数字为两位数（如 3 → "03"）
  const padZero = (num: number): string => num.toString().padStart(2, '0');

  // 拼接为标准格式
  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}