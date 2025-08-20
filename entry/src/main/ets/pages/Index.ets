import { Table, Field, FieldType, Model, GetIBestORM } from '@ibestservices/ibest-orm';
import { IBestButton, IBestDialogUtil, IBestLoading, IBestNotify, IBestTable, IBestTableColumn, IBestTableColumnData} from '@ibestservices/ibest-ui';
import { relationalStore } from '@kit.ArkData';

@Table
export class Apps extends Model {
  @Field({ type: FieldType.TEXT })
  Name?: string

  @Field({ type: FieldType.TEXT })
  Desc?: string

  constructor(name: string, desc: string) {
    super();
    this.Name = name
    this.Desc = desc
  }
}

const TAG = "IBestORM"

let storage = LocalStorage.getShared()

@Entry(storage)
@Component
struct Index {
  @State tableId: string = "table"
  @State data: Record<string, relationalStore.ValueType>[] = []
  @LocalStorageProp('IBestReady') @Watch('onReady') IBestReady: boolean = false;
  private db = GetIBestORM();

  onReady() {
    if(this.IBestReady) {
      this.db = GetIBestORM();
      this.db.AutoMigrate(Apps);
      const error = this.db.GetError();
      if(error) {
        IBestNotify.show({
          message: '创建数据库失败',
          color: '#ad0000',
          backgroundColor: '#ffe1e1',
          duration: 3000
        })
        console.log(TAG, error);
      } else {
        this.data = this.db.Table("Apps").Find();
      }
    }
  }

  reload() {
    this.IBestReady = false;
    setTimeout(() => {
      this.data = this.db.Table("Apps").Find();
      this.IBestReady = true;
    }, 500)
  }

  @Builder customCell(row: Record<string, relationalStore.ValueType>, column: IBestTableColumnData, rowIndex: number, columnIndex: number){
    IBestButton({
      type: "danger",
      buttonSize: 'small',
      text: "删除",
      onBtnClick: () => {
        if(this.db.DeleteByKey(Apps, row.id as number)) {
          this.reload()
        }
      }
    })
  }

  build() {
    Column({space: 20}){
      if(!this.IBestReady) {
        Row() {
          IBestLoading({
            loadingSize: 80,
            loadingText: "加载中...",
            loadingColor: "rgb(25, 137, 250)",
            loadingTextColor: "rgb(25, 137, 250)"
          })
        }.height('100%').width('100%')
        .justifyContent(FlexAlign.Center)
      } else {
        Row({space: 8}) {
          IBestButton({
            type: "primary",
            text: "插入数据",
            onBtnClick: () => {
              const apps = [new Apps("IBest-UI", "鸿蒙开源UI组件库"), new Apps("IBest-ORM", "鸿蒙开源ORM工具库")];
              if (this.db.Create(apps)) {
                this.reload()
              }
            }
          })
          IBestButton({
            type: "primary",
            text: "删除数据",
            onBtnClick: () => {
              if(this.db.Session(Apps).Delete()) {
                this.reload()
              }
            }
          })
          IBestButton({
            type: "primary",
            text: "IBest-UI",
            onBtnClick: () => {
              const app = new Apps("","");
              this.db.Table('Apps').Where('name', 'IBest-UI').First(app);
              if(app.ID) {
                IBestDialogUtil.open({
                  message: JSON.stringify(app)
                })
              }
            }
          })
          IBestButton({
            type: "primary",
            text: "IBest-ORM",
            onBtnClick: () => {
              const app = new Apps("","");
              this.db.Table('Apps').Where('name', 'IBest-ORM').First(app);
              if(app.ID) {
                IBestDialogUtil.open({
                  message: JSON.stringify(app)
                })
              }
            }
          })
        }

        IBestTable({ tableId: this.tableId, data: this.data }) {
          IBestTableColumn({ tableId: this.tableId, title: "ID", prop: "id", cellWidth: 30 })
          IBestTableColumn({ tableId: this.tableId, title: "名称", prop: "name" })
          IBestTableColumn({ tableId: this.tableId, title: "描述", prop: "desc" })
          IBestTableColumn({ tableId: this.tableId, title: "创建时间", prop: "created_at" })
          IBestTableColumn({ tableId: this.tableId, title: "更新时间", prop: "updated_at" })
          IBestTableColumn({
            tableId: this.tableId,
            title: "操作",
            cellWidth: 90,
            cellBuilder: (row: Record<string, relationalStore.ValueType>, column: IBestTableColumnData, rowIndex: number, columnIndex: number): void => this.customCell(row, column, rowIndex, columnIndex)
          })
        }
      }
    }
  }
}