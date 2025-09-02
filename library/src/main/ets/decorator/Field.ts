import { AnyType } from "../model/Global.type";
import { FieldType } from "../model/Global.type";
import { camelToSnakeCase } from "../utils/Utils";
import { Class } from "./Index";

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
    const constructor = target.constructor as Class;

    if (!Object.prototype.hasOwnProperty.call(constructor, '__FieldMeta__')) {
      // 创建新的数组，不继承父类的引用
      constructor.__FieldMeta__ = [];
    }

    if (opts.name === undefined) {
      opts.name = camelToSnakeCase(propertyKey);
    }

    constructor.__FieldMeta__.push({
      propertyKey,
      ...opts
    });
  };
}