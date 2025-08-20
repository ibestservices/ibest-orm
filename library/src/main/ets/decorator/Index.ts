import { AnyType } from "../model/Global.type";
import { FieldParams } from "./Field";

export type Class = new (...args: AnyType[]) => AnyType;

/**
 * 获取实体类的元数据
 */
export function GetTableName(Type: AnyType): string {
  // 返回table name
  return (Type as Class).__MetaData__.name ?? '';
}

/**
 * 获取字段上的元数据
 */
export function GetColumnMeta(Type: AnyType): FieldParams[] {
  return (Type as AnyType).__MetaData__ ?? [];
}