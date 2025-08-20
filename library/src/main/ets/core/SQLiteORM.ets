import { relationalStore  } from '@kit.ArkData';
import { Class, GetColumnMeta, GetTableName } from '../decorator/Index';
import { camelToSnakeCase, createTableSQLByMeta, formatCastExpressions, getLocalTimeString} from '../utils/Utils';
import { FieldType } from "../model/Global.type";

const TAG = "ibest-orm"

class Migrator {
  private rdbStore: relationalStore.RdbStore;

  constructor(rdbStore: relationalStore.RdbStore) {
    this.rdbStore = rdbStore;
  }
  // Tables
  CreateTable(model: Class) {
    // 建表
    if(this.HasTable(model)) {
      return;
    }
    const table = GetTableName(model);
    const meta = GetColumnMeta(model);
    console.log(TAG, createTableSQLByMeta(table, meta))
    this.rdbStore!.executeSql(createTableSQLByMeta(table, meta))
  }

  DropTable(model: Class) {
    const table = GetTableName(model);
    return this.rdbStore!.executeSql(`DROP TABLE IF EXISTS ${table};`);
  }

  HasTable(model: Class|string): boolean {
    let table = "";
    if(typeof model === "string") {
      table = model;
    } else {
      table = GetTableName(model);
    }

    let resultSet = this.rdbStore!.querySqlSync(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`);
    let res: boolean = false;
    if(resultSet.rowCount > 0) {
      res = true;
    }
    resultSet.close();
    return res;
  }

  GetTableInfo(model: Class|string) {
    let table = "";
    if(typeof model === "string") {
      table = model;
    } else {
      table = GetTableName(model);
    }
    let resultData: Array<Record<string, relationalStore.ValueType>> = []
    let resultSet = this.rdbStore!.querySqlSync(`PRAGMA table_info('${table}');`);
    if(resultSet.columnCount > 0) {
      if (resultSet.goToFirstRow()) {
        while (!resultSet.isEnded) {
          let Model: Record<string, relationalStore.ValueType> = {}
          for (let i = 0; i < resultSet.columnNames.length; i++) {
            let value = resultSet.columnNames[i]
            Model[value] = resultSet.getValue(resultSet.getColumnIndex(value))
          }

          if (!resultData.includes(Model)) {
            resultData.push(Model)
          }
          resultSet.goToNextRow()
        }
      }
    }
    return resultData;
  }

  async RenameTable(oldName: string, newName: string) {
    if(!this.HasTable(oldName)) {
      console.log(TAG, "未创建数据表");
      return false;
    }
    await this.rdbStore!.executeSql(`ALTER TABLE ${oldName} RENAME TO ${newName};`);
    return true;
  }
  // Columns
  HasColumn(model: Class|string, field: string): boolean {
    let table = "";
    if(typeof model === "string") {
      table = model;
    } else {
      table = GetTableName(model);
    }
    let resultSet = this.rdbStore!.querySqlSync(`SELECT COUNT(*) FROM pragma_table_info('${table}') WHERE name = '${field}';`);
    if(resultSet.rowCount > 0 && resultSet.goToFirstRow()) {
      let value = resultSet.columnNames[0]
      let ret = resultSet.getDouble(resultSet.getColumnIndex(value));
      return ret >= 1;
    }
    return false;
  }

  async AddColumn(model: Class) {
    if(!this.HasTable(model)) {
      console.log(TAG, "未创建数据表");
      return false;
    }
    let fields: string[] = this.GetTableFields(model);
    const table = GetTableName(model);
    const meta = GetColumnMeta(model);
    for (let i = 0; i < meta.length; i++) {
      const item = meta[i];
      const name = item.name!;
      const fieldType = item.type;
      const tag = item.tag ? item.tag: [];
      const isNotNull = tag.includes('notNull') ? "NOT NULL" : "";
      const isPrimaryKey = tag.includes('primaryKey') ? "PRIMARY KEY" : "";
      const autoIncrement = (fieldType == FieldType.INTEGER && tag.includes('autoIncrement')) ? "AUTOINCREMENT" : "";
      if(!fields.includes(name)) {
        let sqlStr = `ALTER TABLE ${table} ADD COLUMN ${name} ${fieldType} ${isNotNull} ${isPrimaryKey} ${autoIncrement};`
        if(fieldType == FieldType.TEXT && (tag.includes('autoCreateTime') || tag.includes('autoUpdateTime'))) {
          sqlStr += ` DEFAULT (DATETIME('now', 'localtime'))`;
        }
        await this.rdbStore!.executeSql(`${sqlStr};`);
      }
    }
    return true;
  }

  async DropColumn(model: Class) {
    if(!this.HasTable(model)) {
      console.log(TAG, "未创建数据表");
      return false;
    }
    let fields: string[] = this.GetTableFields(model);
    let metaFields: string[] = [];
    const table = GetTableName(model);
    const meta = GetColumnMeta(model);
    for (let i = 0; i < meta.length; i++) {
      metaFields.push(meta[i].name!)
    }
    if(!this.DiffStringArray(metaFields, fields)) {
      for (let i = 0; i < fields.length; i++) {
        if(!metaFields.includes(fields[i])) {
          await this.rdbStore!.executeSql(`ALTER TABLE ${table} DROP COLUMN ${fields[i]};`);
        }
      }
    }
    return true;
  }

  async AlterColumn(model: Class) {
    if(!this.HasTable(model)) {
      console.log(TAG, "未创建数据表");
      return false;
    }
    let isAlter: boolean = false;
    const info = this.GetTableInfo(model);
    const table = GetTableName(model);
    const meta = GetColumnMeta(model);
    let newFields: string[] = [];
    let newTypes: FieldType[] = [];
    for (let i = 0; i < meta.length; i++) {
      const metaType = meta[i].type;
      const name = meta[i].name!
      newFields.push(name);
      newTypes.push(metaType);
      for (let j = 0; j < info.length; j++) {
        const field = info[j]["name"];
        const fieldType = info[j]["type"];
        if(field === name && fieldType !== metaType) {
          isAlter = true;
          break;
        }
      }
    }

    if(isAlter) {
      //console.log(TAG, createTableSQLByMeta("temp_"+table, meta))
      //console.log(TAG, `INSERT INTO temp_${table} (${newFields.join(', ')}) SELECT ${formatCastExpressions(newFields, newTypes)} FROM ${table};`)
      await this.rdbStore!.executeSql(createTableSQLByMeta("temp_"+table, meta));
      await this.rdbStore!.executeSql(`INSERT INTO temp_${table} (${newFields.join(', ')}) SELECT ${formatCastExpressions(newFields, newTypes)} FROM ${table};`);
      await this.DropTable(model);
      await this.RenameTable("temp_"+table, table);
    }

    return true;
  }

  private GetTableFields(model: Class): string[] {
    let fields: string[] = [];
    const info = this.GetTableInfo(model);
    for (let i = 0; i < info.length; i++) {
      let item = info[i];
      fields.push(item["name"] as string)
    }
    return fields;
  }
  private DiffStringArray(arr1: string[], arr2: string[]) {
    if(arr1.length !== arr2.length) {
      return false;
    }
    return !arr1.some((item) => !arr2.includes(item));
  }
}

export class IBestORM {
  private rdbStore: relationalStore.RdbStore|null = null
  private storeConfig: relationalStore.StoreConfig
  private error: string|null = null
  private tableName: string|null = null
  private columns: Array<string> = []
  private predicates: relationalStore.RdbPredicates|null = null
  private migrator: Migrator|null = null

  private constructor(
    rdbStore: relationalStore.RdbStore,
    storeConfig: relationalStore.StoreConfig
  ) {
    this.rdbStore = rdbStore;
    this.storeConfig = storeConfig;
    this.migrator = new Migrator(rdbStore); // 此时rdbStore已就绪，无需!断言
    console.log(TAG, "SQLiteORM Init");
  }

  static async Init(Context: Context, Config: relationalStore.StoreConfig): Promise<IBestORM> {
    try {
      const rdbStore = await relationalStore.getRdbStore(Context, Config);
      return new IBestORM(rdbStore, Config);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.log(TAG, "SQLiteORM Init Error:", error.message);
      throw error;
    }
  }

  Migrator() {
    return this.migrator!
  }

  AutoMigrate(model: Class) {
    if(!this.Migrator().HasTable(model)) {
      this.Migrator().CreateTable(model);
      return;
    }
    this.Migrator().AddColumn(model);
    //this.Migrator().DropColumn(model);
    this.Migrator().AlterColumn(model);
  }

  Create(model: Object|Array<Object>): number {
    let table = "";
    let values: relationalStore.ValuesBucket|Array<relationalStore.ValuesBucket> = {};
    if(Array.isArray(model)) {
      values = new Array() as Array<relationalStore.ValuesBucket>;
      for (let i = 0; i < model.length; i++) {
        table = GetTableName(model[i].constructor);
        const meta = GetColumnMeta(model[i].constructor);
        let tmp: relationalStore.ValuesBucket = {}
        for (let j = 0; j < meta.length; j++) {
          const key = meta[j].propertyKey!
          if((this.columns.length > 0 && this.columns.includes(camelToSnakeCase(key))) || this.columns.length == 0) {
            tmp[key] = model[i][key];
          }
        }
        values.push(tmp)
      }
    } else {
      table = GetTableName(model.constructor);
      const meta = GetColumnMeta(model.constructor);
      for (let i = 0; i < meta.length; i++) {
        const key = meta[i].propertyKey!
        if((this.columns.length > 0 && this.columns.includes(camelToSnakeCase(key))) || this.columns.length == 0) {
          values[key] = (model as relationalStore.ValuesBucket)[key]
        }
      }
    }
    return this.Table(table).Insert(values);
  }

  DeleteByEntity(model: Object) {
    const meta = GetColumnMeta(model.constructor);
    let res: number = 0;
    for (let i = 0; i < meta.length; i++) {
      if(meta[i].tag?.includes('primaryKey')) {
        const propertyKey = meta[i].propertyKey!
        res = this.DeleteByKey(model.constructor as Class, ((model as relationalStore.ValuesBucket)[propertyKey]) as number)
        break;
      }
    }
    return res;
  }

  DeleteByKey(model: Class, keyValue: number|number[]): number {
    const table = GetTableName(model);
    const meta = GetColumnMeta(model);
    let primaryKey = "id";
    for (let i = 0; i < meta.length; i++) {
      if(meta[i].tag?.includes('primaryKey')) {
        primaryKey = meta[i].name!
      }
    }
    return this.Table(table).Where(primaryKey, keyValue).Delete()
  }

  Save(model: Object): number {
    const table = GetTableName(model.constructor);
    const meta = GetColumnMeta(model.constructor);
    let primaryKey = "id";
    let key = 0;
    let data: relationalStore.ValuesBucket = {};
    for (let i = 0; i < meta.length; i++) {
      if(meta[i].tag?.includes('autoUpdateTime')) {
        data[meta[i].name!] = getLocalTimeString();
        continue
      }
      if(meta[i].tag?.includes('primaryKey')) {
        primaryKey = meta[i].name!
        key = (model as relationalStore.ValuesBucket)[meta[i].propertyKey!] as number
        continue
      }
      data[meta[i].name!] = (model as relationalStore.ValuesBucket)[meta[i].propertyKey!]
    }
    if(key > 0) {
      return this.Table(table).Where(primaryKey, key).Update(data);
    }
    return 0;
  }

  Table(TableName: string) {
    this.tableName = TableName
    this.columns = []
    this.predicates = new relationalStore.RdbPredicates(this.tableName)
    return this
  }

  Session(model: Class) {
    const table = GetTableName(model);
    this.tableName = table
    this.columns = []
    this.predicates = new relationalStore.RdbPredicates(this.tableName)
    return this
  }

  Insert(Data: relationalStore.ValuesBucket|Array<relationalStore.ValuesBucket>) {
    if(this.notSetTableError()) return -1
    if(Array.isArray(Data)) {
      if(Array.length > 0) return this.rdbStore!.batchInsertSync(this.tableName, Data)
    } else {
      return this.rdbStore!.insertSync(this.tableName, Data)
    }
    return 0
  }

  First(Ref?: Object, FailureCall?: (msg: string) => void) {
    let Model: Record<string, relationalStore.ValueType> = Ref as Record<string, relationalStore.ValueType> || {}
    let resultSet = this.rdbStore!.querySync(this.predicates, this.columns)
    if(resultSet.rowCount > 0) {
      if (resultSet.goToFirstRow()) {
        for (let i = 0; i < resultSet.columnNames.length; i++) {
          let value = resultSet.columnNames[i]
          if((this.columns.length > 0 && this.columns.includes(value)) || this.columns.length == 0) {
            if(Ref) {
              const meta = GetColumnMeta(Ref.constructor);
              for (let j = 0; j < meta.length; j++) {
                if(meta[j].name! == value) {
                  Model[meta[j].propertyKey!] = resultSet.getValue(resultSet.getColumnIndex(value))
                }
              }
            } else {
              Model[value] = resultSet.getValue(resultSet.getColumnIndex(value))
            }
          }
        }
      } else {
        this.error = "Go To First Row Failed"
        if (FailureCall) FailureCall(this.error)
      }
    }
    resultSet.close()
    return Model
  }

  Last(Ref?: Object, FailureCall?: (msg: string) => void) {
    let Model: Record<string, relationalStore.ValueType> = Ref as Record<string, relationalStore.ValueType> || {}
    let resultSet = this.rdbStore!.querySync(this.predicates, this.columns)
    if(resultSet.rowCount > 0) {
      if (resultSet.goToLastRow()) {
        for (let i = 0; i < resultSet.columnNames.length; i++) {
          let value = resultSet.columnNames[i]
          if((this.columns.length > 0 && this.columns.includes(value)) || this.columns.length == 0) {
            if(Ref) {
              const meta = GetColumnMeta(Ref.constructor);
              for (let j = 0; j < meta.length; j++) {
                if(meta[j].name! == value) {
                  Model[meta[j].propertyKey!] = resultSet.getValue(resultSet.getColumnIndex(value))
                }
              }
            } else {
              Model[value] = resultSet.getValue(resultSet.getColumnIndex(value))
            }
          }
        }
      } else {
        this.error = "Go To Last Row Failed"
        if (FailureCall) FailureCall(this.error)
      }
    }
    resultSet.close()
    return Model
  }

  Find(FailureCall?: (msg: string) => void) {
    let resultSet = this.rdbStore!.querySync(this.predicates, this.columns)
    let resultData: Array<Record<string, relationalStore.ValueType>> = []
    if(resultSet.rowCount > 0) {
      if (resultSet.goToFirstRow()) {
        while (!resultSet.isEnded) {
          let Model: Record<string, relationalStore.ValueType> = {}
          for (let i = 0; i < resultSet.columnNames.length; i++) {
            let value = resultSet.columnNames[i]
            if((this.columns.length > 0 && this.columns.includes(value)) || this.columns.length == 0) {
              Model[value] = resultSet.getValue(resultSet.getColumnIndex(value))
            }
          }

          if (!resultData.includes(Model)) {
            resultData.push(Model)
          }
          resultSet.goToNextRow()
        }
      } else {
        this.error = "Go To First Row Failed"
        if (FailureCall) FailureCall(this.error)
      }
    }
    resultSet.close()
    return resultData
  }

  Update(Data: relationalStore.ValuesBucket) {
    let values: relationalStore.ValuesBucket = {};
    const keys = Object.keys(Data);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if((this.columns.length > 0 && this.columns.includes(camelToSnakeCase(key))) || this.columns.length == 0) {
        values[key] = Data[key];
      }
    }
    if(this.Migrator().HasColumn(this.tableName!, "updated_at")) {
      values["updated_at"] = getLocalTimeString();
    }
    return this.rdbStore!.updateSync(values, this.predicates)
  }

  Delete() {
    return this.rdbStore!.deleteSync(this.predicates)
  }

  Select(Columns: Array<string>) {
    this.columns = Columns
    return this
  }

  Where(Key: string|Array<string>, Value: string|number|boolean|Array<string|number|boolean>) {
    if(this.notSetTableError()) return this
    if(typeof Key === 'string' && (Value === undefined || Value === null)) {
      this.predicates!.isNull(Key)
    }else if(typeof Key === 'object' && (Value === undefined || Value === null)) {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.isNull(Key[i])
      }
    }else if(typeof Key === 'string' && (typeof Value === 'string' || typeof Value === 'number' || typeof Value === 'boolean')) {
      this.predicates!.equalTo(Key, Value)
    }else if(typeof Key === 'object' && typeof Value === 'object') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.equalTo(Key[i], Value[i])
      }
    }else if(typeof Key === 'string' && typeof Value === 'object') {
      this.predicates!.in(Key, Value)
    }
    return this
  }

  Not(Key: string|Array<string>, Value: string|number|boolean|Array<string|number|boolean>) {
    if(this.notSetTableError()) return this
    if(typeof Key === 'string' && (Value === undefined || Value === null)) {
      this.predicates!.isNotNull(Key)
    }else if(typeof Key === 'object' && (Value === undefined || Value === null)) {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.isNotNull(Key[i])
      }
    }else if(typeof Key === 'string' && (typeof Value === 'string' || typeof Value === 'number' || typeof Value === 'boolean')) {
      this.predicates!.notEqualTo(Key, Value)
    }else if(typeof Key === 'object' && typeof Value === 'object') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.notEqualTo(Key[i], Value[i])
      }
    }else if(typeof Key === 'string' && typeof Value === 'object') {
      this.predicates!.notIn(Key, Value)
    }
    return this
  }

  Like(Key: string|Array<string>, Value: string|Array<string>) {
    if(this.notSetTableError()) return this
    if(typeof Key === 'string' && typeof Value === 'string') {
      this.predicates!.like(Key, Value)
    }else if(typeof Key === 'object' && typeof Value === 'string') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.like(Key[i], Value)
      }
    }else if(typeof Key === 'object' && typeof Value === 'object') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.like(Key[i], Value[i])
      }
    }
    return this
  }

  Between(Key: string, Min: relationalStore.ValueType = 0, Max: relationalStore.ValueType = 0) {
    if(this.notSetTableError()) return this
    this.predicates!.between(Key, Min, Max)
    return this
  }

  NotBetween(Key: string, Min: relationalStore.ValueType = 0, Max: relationalStore.ValueType = 0) {
    if(this.notSetTableError()) return this
    this.predicates!.notBetween(Key, Min, Max)
    return this
  }

  Greater(Key: string|Array<string>, Value: number|Array<number>) {
    if(this.notSetTableError()) return this
    if(typeof Key === 'string' && typeof Value === 'number') {
      this.predicates!.greaterThan(Key, Value)
    }else if(typeof Key === 'object' && typeof Value === 'number') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.greaterThan(Key[i], Value)
      }
    }else if(typeof Key === 'object' && typeof Value === 'object') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.greaterThan(Key[i], Value[i])
      }
    }
    return this
  }

  Less(Key: string|Array<string>, Value: number|Array<number>) {
    if(this.notSetTableError()) return this
    if(typeof Key === 'string' && typeof Value === 'number') {
      this.predicates!.lessThan(Key, Value)
    }else if(typeof Key === 'object' && typeof Value === 'number') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.lessThan(Key[i], Value)
      }
    }else if(typeof Key === 'object' && typeof Value === 'object') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.lessThan(Key[i], Value[i])
      }
    }
    return this
  }

  GreaterOrEqualTo(Key: string|Array<string>, Value: number|Array<number>) {
    if(this.notSetTableError()) return this
    if(typeof Key === 'string' && typeof Value === 'number') {
      this.predicates!.greaterThanOrEqualTo(Key, Value)
    }else if(typeof Key === 'object' && typeof Value === 'number') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.greaterThanOrEqualTo(Key[i], Value)
      }
    }else if(typeof Key === 'object' && typeof Value === 'object') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.greaterThanOrEqualTo(Key[i], Value[i])
      }
    }
    return this
  }

  LessOrEqualTo(Key: string|Array<string>, Value: number|Array<number>) {
    if(this.notSetTableError()) return this
    if(typeof Key === 'string' && typeof Value === 'number') {
      this.predicates!.lessThanOrEqualTo(Key, Value)
    }else if(typeof Key === 'object' && typeof Value === 'number') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.lessThanOrEqualTo(Key[i], Value)
      }
    }else if(typeof Key === 'object' && typeof Value === 'object') {
      for(let i = 0; i < Key.length; i++) {
        this.predicates!.lessThanOrEqualTo(Key[i], Value[i])
      }
    }
    return this
  }

  Or() {
    this.predicates!.or()
    return this
  }

  And() {
    this.predicates!.and()
    return this
  }

  OrderByAsc(Key: string) {
    if(this.notSetTableError()) return this
    this.predicates!.orderByAsc(Key)
    return this
  }

  OrderByDesc(Key: string) {
    if(this.notSetTableError()) return this
    this.predicates!.orderByDesc(Key)
    return this
  }

  Limit(Len: number) {
    if(this.notSetTableError()) return this
    this.predicates!.limitAs(Len)
    return this
  }

  Offset(Len: number) {
    if(this.notSetTableError()) return this
    this.predicates!.offsetAs(Len)
    return this
  }

  Group(Keys: string|Array<string>) {
    if(this.notSetTableError()) return this
    if(typeof Keys === 'string') {
      this.predicates!.groupBy([Keys])
    }else if(typeof Keys === 'object') {
      this.predicates!.groupBy(Keys)
    }
    return this
  }

  Begin() {
    this.rdbStore!.beginTransaction()
  }

  Rollback() {
    this.rdbStore!.rollBack()
  }

  Commit() {
    this.rdbStore!.commit()
  }

  GetError() {
    return this.error
  }

  private notSetTableError() {
    if(this.tableName == null || this.predicates == null) {
      this.error = 'Not Set Table Error'
      return true
    }
    if(this.rdbStore == null) {
      this.error = 'rdbStore Error'
      return true
    }
    return false
  }
}