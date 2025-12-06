/**
 * 测试导航首页
 */
import { router } from '@kit.ArkUI';

interface TestItem {
  title: string;
  desc: string;
  page: string;
}

@Entry
@Component
struct Index {
  private testItems: TestItem[] = [
    { title: '单元测试 (Memory)', desc: 'MemoryAdapter 快速测试 ORM 核心功能', page: 'pages/ORMNextTest' },
    { title: '单元测试 (RdbStore)', desc: 'RdbStore 适配器测试 ORM 功能', page: 'pages/RdbStoreTest' },
    { title: '集成测试', desc: 'RdbStore 完整业务流程 + 性能测试', page: 'pages/IntegrationTest' }
  ];

  build() {
    Column() {
      Text('IBest-ORM v2.0 测试')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 40, bottom: 30 })

      Text('选择测试类型')
        .fontSize(16)
        .fontColor('#666')
        .margin({ bottom: 20 })

      ForEach(this.testItems, (item: TestItem) => {
        Column() {
          Text(item.title)
            .fontSize(20)
            .fontWeight(FontWeight.Medium)
            .fontColor('#333')

          Text(item.desc)
            .fontSize(14)
            .fontColor('#666')
            .margin({ top: 8 })
        }
        .width('90%')
        .padding(20)
        .margin({ bottom: 15 })
        .backgroundColor('#f5f5f5')
        .borderRadius(12)
        .alignItems(HorizontalAlign.Start)
        .onClick(() => {
          router.pushUrl({ url: item.page });
        })
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#fff')
  }
}
