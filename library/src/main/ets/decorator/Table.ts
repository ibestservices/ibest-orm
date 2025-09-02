import { AnyType } from "../model/Global.type";
import { camelToSnakeCase } from "../utils/Utils";
import { FieldParams } from "./Field";
import { Class } from "./Index";
import { RelationConfig } from "./Relation";

declare global {
  interface Function {
    // 表元数据（对象）
    __TableMeta__?: Partial<TableParams>;
    // 字段元数据（数组）
    __FieldMeta__?: FieldParams[];
    // 关联元数据（保持不变）
    __RelationMeta__?: RelationConfig[];
  }
}

interface TableParams {
  name: string;
}

/**
 * 数据表（类）装饰器，带参数和不带参数2种
 */
export const Table = (arg: TableParams | Class): AnyType => {
  // 带参数的情况：返回类装饰器
  if (typeof arg === 'object') {
    return (target: Class) => {
      target.__TableMeta__ = { ...arg };
    };
  }
  // 不带参数的情况：直接处理构造函数
  else if (typeof arg === 'function') {
    arg.__TableMeta__ = arg.__TableMeta__ || {};
    arg.__TableMeta__.name = camelToSnakeCase(arg.name);
  }
};