import { common } from "@kit.AbilityKit"
import { IBestORM } from "../core/SQLiteORM"
import { relationalStore } from "@kit.ArkData"

// 全局存储中心
export default class GlobalStore {
  // context
  public static context: common.UIAbilityContext;
  public static orm: IBestORM;
  /**
   * 初始化
   */
  public static async init(context: common.UIAbilityContext, config: relationalStore.StoreConfig){
    GlobalStore.context = context
    GlobalStore.orm = await IBestORM.Init(context, config)
  }
}