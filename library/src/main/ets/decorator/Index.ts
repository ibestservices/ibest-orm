import { AnyType } from "../model/Global.type";
import { FieldParams } from "./Field";
import { RelationConfig } from "./Relation";

export interface TableMeta {
  name: string;
}

export type Class = new (...args: AnyType[]) => AnyType & {
  __TableMeta__?: TableMeta;
  __FieldMeta__?: FieldParams[];
  __RelationMeta__?: RelationConfig[];
};

/**
 * 获取实体类的元数据
 */
export const GetTableName = (Type: Class): string => {
  // 返回table name
  if (!Type || !Type.__TableMeta__) {
    console.error('GetTableName: 类型无效或缺少表元数据', Type?.name || 'unknown');
    try {
      const error = new Error();
      console.log(error.stack);
    } catch (err) {
      console.error("无法获取调用栈信息:", err);
    }
    return '';
  }
  return Type.__TableMeta__.name ?? '';
}

/**
 * 获取字段上的元数据
 */
export const GetColumnMeta = (Type: Class): FieldParams[] => {
  const meta: FieldParams[] = [];
  let currentClass: Class | null = Type;

  // 收集继承链上的所有字段元数据
  const classChain: Class[] = [];

  // 先收集完整的类继承链
  while (currentClass && currentClass !== Object && currentClass.name !== '') {
    classChain.push(currentClass);
    currentClass = Object.getPrototypeOf(currentClass) as Class | null;
  }

  // 从父类到子类的顺序处理（父类字段在前）
  for (let i = classChain.length - 1; i >= 0; i--) {
    const cls = classChain[i];
    // 只处理当前类自己定义的字段元数据
    if (Object.prototype.hasOwnProperty.call(cls, '__FieldMeta__')) {
      const fieldMeta = cls.__FieldMeta__ || [];
      meta.push(...fieldMeta);
    }
  }

  return meta;
}

/**
 * 获取实体类的关联元数据
 */
export const GetRelationMeta = (Type: Class): RelationConfig[] => {
  return (Type as Class).__RelationMeta__ ?? [];
}

/**
 * 根据属性名获取关联配置
 */
export const GetRelationConfig = (Type: Class, propertyKey: string): RelationConfig | undefined => {
  const relations = GetRelationMeta(Type);
  return relations.find(relation => relation.propertyKey === propertyKey);
}

/**
 * 检查实体是否有关联关系
 */
export const HasRelations = (Type: Class): boolean => {
  const relations = GetRelationMeta(Type);
  return relations && relations.length > 0;
}