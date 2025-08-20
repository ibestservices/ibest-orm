import { AnyType } from "../model/Global.type";
import { Class } from "./Index";

// 扩展Function接口，让__MetaData__可以是Partial<TableParams>（所有属性可选）
declare global {
  interface Function {
    __MetaData__?: Partial<TableParams>;
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
      target.__MetaData__ = { ...arg };
    };
  }
  // 不带参数的情况：直接处理构造函数
  else if (typeof arg === 'function') {
    arg.__MetaData__ = arg.__MetaData__ || {};
    arg.__MetaData__.name = arg.name;
  }
};