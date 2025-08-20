import { Field } from "../decorator/Field";
import { FieldType } from "./Global.type";

export abstract class Model {
  @Field({ type: FieldType.INTEGER, tag: ['primaryKey', 'autoIncrement', 'notNull'] })
  ID?: number
  @Field({ type: FieldType.TEXT, tag: ['autoCreateTime', 'notNull'] })
  CreatedAt?: string
  @Field({ type: FieldType.TEXT, tag: ['autoUpdateTime', 'notNull'] })
  UpdatedAt?: string
}