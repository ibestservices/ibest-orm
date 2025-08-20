import { Table, Field, FieldType, Model, GetIBestORM } from '@ibestservices/ibest-orm';
import { relationalStore } from '@kit.ArkData';

@Table
export class User extends Model {
  /**
   * 名字
   */
  @Field({ type: FieldType.TEXT })
  Name?: string
  /**
   * 年龄
   */
  @Field({ type: FieldType.TEXT })
  Age?: string

  @Field({ type: FieldType.INTEGER })
  Salary?: number

  //@Field({ type: FieldType.TEXT })
  //Desc?: string

  constructor(name: string, age: number, salary: number) {
    super();
    this.Name = name
    this.Age = age.toString()
    this.Salary = salary
  }
}

@Entry
@Component
struct Index {
  @State Text: string = "Mysql Test"
  private Mysql = GetIBestORM()
  private insert: string = "INSERT INTO 'UserPage' ('Name', 'Age', 'Salary') VALUES ('ming', 12, 120.5)"
  private select: string = "SELECT * FROM 'UserPage' WHERE 'Age' = 12 AND 'Name' = 'ming'"
  private select2: string = "SELECT 'Age', 'Name' FROM 'UserPage' WHERE 'Age' = 12 AND 'Name' = 'ming'"
  private update: string = "UPDATE 'UserPage' SET 'Salary' = 8888 WHERE 'Name' = 'ming';"
  private delete: string = "DELETE FROM 'UserPage' WHERE 'Name' = 'ming';"

  build() {
    Column() {
      Row(){
        RichText("<p style=\"font-size: 35px;text-align: center;font-weight: bold; color: rgb(24,78,228)\">"+ this.Text +"</p>")
          .width('100%')
          .height(100)
      }

      Row(){
        Button("CREATE TABLE 'User' ... ").onClick(()=>{
          this.Mysql.AutoMigrate(User);
          this.Text += "\n<br/> Mysql.AutoMigrate('User'); "
          if(this.Mysql.GetError()){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] "
          }
        })
      }.padding(10)

      Row(){
        Button("AutoMer").onClick(async ()=>{
          console.log("####HasTable", JSON.stringify(this.Mysql.Migrator().HasTable(User)))
          console.log("####HasTable", JSON.stringify(this.Mysql.Migrator().HasTable('User')))
          console.log("####HasColumn", JSON.stringify(this.Mysql.Migrator().HasColumn(User, 'age')))
          console.log("####HasTable", JSON.stringify(this.Mysql.Migrator().GetTableInfo(User)))
          //console.log("####AddColumn", JSON.stringify(this.Mysql.Migrator().AddColumn(User)))
          //console.log("####DropColumn", JSON.stringify(this.Mysql.Migrator().DropColumn(User)))
          //console.log("####AlterColumn", JSON.stringify(await this.Mysql.Migrator().AlterColumn(User)))
          //setTimeout(()=>{
            //console.log("####HasTable", JSON.stringify(this.Mysql.Migrator().GetTableInfo(User)))
          //}, 2000)
        })
      }.padding(10)

      Row(){
        Button("Create").onClick(()=>{
          const user = [new User("groot", 33, 10000), new User("groot", 34, 10000)];
          this.Mysql.Select(["name", "age"]).Create(user);
          this.Text += "\n<br/> Mysql.Create('User'); "
          if(this.Mysql.GetError()){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] "
            let result: Object = this.Mysql.Table("User").Where('name','groot').Find()
            console.log("####", JSON.stringify(result))
          }
        })
      }.padding(10)

      Row(){
        Button(this.insert).onClick(()=>{
          const valueBucket: relationalStore.ValuesBucket = {
            'Name': 'ming',
            'Age': 12,
            'Salary': 120.5
          };
          let id: number|undefined = this.Mysql.Table("User").Insert(valueBucket)
          this.Text += "\n<br/> Mysql.Table('User').Insert("+JSON.stringify(valueBucket)+")'; "
          if(id > 0) {
            this.Text += " [successful] "
          }else{
            this.Text += " [failed] " + this.Mysql.GetError()
          }
        })
      }
      .padding(10)

      Row(){
        Button(this.select).onClick(()=>{
          let result: Array<Object> = this.Mysql.Table("User").Where('age', 12).Where('name','ming').Find()
          this.Text += "\n<br/> Mysql.Table('User').Where('age', 12).Where('name','ming').Find(); "
          if(this.Mysql.GetError()){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] result: "+ JSON.stringify(result)
          }
        })
      }
      .padding(10)
      Row(){
        Button(this.select2).onClick(()=>{
          let result: Array<Object> = this.Mysql.Table("User").Select(['name', 'age']).Where('age', 12).Where('name','ming').Find()
          this.Text += "\n<br/> Mysql.Table('User').Select(['name', 'age']).Where('age', 12).Where('name','ming').Find(); "
          if(this.Mysql.GetError()){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] result: "+ JSON.stringify(result)
          }
        })
      }
      .padding(10)
      Row(){
        Button("FindAll").onClick(()=>{
          let result: Array<Object> = this.Mysql.Table("User").Find()
          this.Text += "\n<br/> Mysql.Table('User').Find(); "
          if(this.Mysql.GetError()){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] result: "+ JSON.stringify(result)
          }
        })
        Button("FindID=1").onClick(()=>{
          let ref = new User("", 0, 0)
          let result: Object = this.Mysql.Table("User").Where('id', 1).First(ref)
          this.Text += "\n<br/> Mysql.Table('User').Where('id', 1).First(); "
          if(this.Mysql.GetError()){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] result: "+ JSON.stringify(result)
            ref.Age = '999'
            this.Mysql.Save(ref)
          }
        })
      }
      .padding(10)

      Row(){
        Button(this.update).onClick(()=>{
          const valueBucket: relationalStore.ValuesBucket = {
            'salary': 8889
          };
          let result: number = this.Mysql.Table("User").Where('name', 'ming').Update(valueBucket)
          this.Text += "\n<br/> Mysql.Table('User').Where('name', 'ming').Update("+JSON.stringify(valueBucket)+"); "
          if(result <= 0){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] "
          }
        })
      }
      .padding(10)

      Row(){
        Button(this.delete).onClick(()=>{
          let result: number = this.Mysql.Table("User").Where('name','ming').Delete()
          this.Text += "\n<br/> Mysql.Table('User').Where('name','ming').Delete(); "
          if(result <= 0){
            this.Text += " [failed] " + this.Mysql.GetError()
          }else{
            this.Text += " [successful] "
          }
        })
      }
      .padding(10)

    }
    .width('100%')
    .height('100%')
    .padding(10)
    .backgroundColor('rgba(80,69,46,0.26)')
  }
}