import { AnyType } from "../model/Global.type";
import { FieldType } from "../model/Global.type";
import { camelToSnakeCase } from "../utils/Utils";

export type FieldTag =
  |'primaryKey'                        // 定义为主键
  |'notNull'                           // 字段不为空
  |'autoIncrement'                     // 自增列
  |'autoCreateTime'                    // 追踪创建时间
  |'autoUpdateTime'                    // 追踪更新时间

export interface FieldParams {
  /**
   * 字段名
   */
  name?: string;

  /**
   * 字段类型
   */
  type: FieldType;

  /**
   * 自定义标签
   */
  tag?: FieldTag[];

  /**
   * ts属性名
   */
  propertyKey?: string
}

/**
 * 字段装饰器
 */
export function Field(opts: FieldParams) {
  return function (target: AnyType, propertyKey: string) {
    if (!target.constructor.__MetaData__) {
      target.constructor.__MetaData__ = [];
    }
    if (opts.name === undefined) {
      opts.name = camelToSnakeCase(propertyKey)
    }
    target.constructor.__MetaData__.push({
      propertyKey,
      ...opts
    });
  };
}