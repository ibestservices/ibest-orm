/**
 * RdbStore 适配器测试页面
 * 使用 RelationalStoreAdapter 测试 ORM 功能
 */
import { runAllTests, getTestStats, TestResult, TestSuite, TestStats, IBestORMInit } from '@ibestservices/ibest-orm';
import { relationalStore } from '@kit.ArkData';

@Entry
@Component
struct RdbStoreTest {
  @State testSuites: TestSuite[] = [];
  @State isRunning: boolean = false;
  @State stats: TestStats = new TestStats();

  build() {
    Column() {
      Text('单元测试 (RdbStore)')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 20, bottom: 20 })

      Button(this.isRunning ? '测试中...' : '运行测试')
        .width('80%')
        .height(50)
        .fontSize(18)
        .enabled(!this.isRunning)
        .onClick(() => this.runTests())
        .margin({ bottom: 20 })

      if (this.stats.total > 0) {
        Row() {
          Text(`总计: ${this.stats.total}`).fontSize(16).margin({ right: 20 })
          Text(`通过: ${this.stats.passed}`).fontSize(16).fontColor('#4CAF50').margin({ right: 20 })
          Text(`失败: ${this.stats.failed}`).fontSize(16).fontColor(this.stats.failed > 0 ? '#F44336' : '#999')
        }.margin({ bottom: 20 })
      }

      List() {
        ForEach(this.testSuites, (suite: TestSuite) => {
          ListItemGroup({ header: this.suiteHeader(suite) }) {
            ForEach(suite.results, (result: TestResult) => {
              ListItem() { this.testResultItem(result) }
            })
          }
        })
      }
      .width('100%')
      .layoutWeight(1)
      .divider({ strokeWidth: 1, color: '#eee' })
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#f5f5f5')
  }

  @Builder
  suiteHeader(suite: TestSuite) {
    Row() {
      Text(suite.name).fontSize(18).fontWeight(FontWeight.Medium)
      Blank()
      Text(`${suite.results.filter((r: TestResult): boolean => r.passed).length}/${suite.results.length}`).fontSize(14).fontColor('#666')
    }
    .width('100%')
    .padding({ top: 12, bottom: 12, left: 8, right: 8 })
    .backgroundColor('#e0e0e0')
  }

  @Builder
  testResultItem(result: TestResult) {
    Column() {
      Row() {
        Text(result.passed ? '✓' : '✗').fontSize(16).fontColor(result.passed ? '#4CAF50' : '#F44336').margin({ right: 8 })
        Text(result.name).fontSize(14).fontColor(result.passed ? '#333' : '#F44336').layoutWeight(1)
      }.width('100%')

      if (!result.passed && result.error) {
        Text(result.error).fontSize(12).fontColor('#F44336').margin({ top: 4, left: 24 }).maxLines(3)
      }
    }
    .width('100%')
    .padding({ top: 8, bottom: 8, left: 16, right: 16 })
    .backgroundColor('#fff')
  }

  private runTests() {
    this.isRunning = true;
    this.testSuites = [];

    setTimeout(async () => {
      try {
        // 删除旧数据库，确保每次测试从干净状态开始
        await relationalStore.deleteRdbStore(getContext(this), 'test_rdbstore.db');
        await IBestORMInit(getContext(this), { name: 'test_rdbstore.db' });
        this.testSuites = runAllTests();
        this.stats = getTestStats();
      } catch (e) {
        console.error('测试运行失败:', e);
      } finally {
        this.isRunning = false;
      }
    }, 100);
  }
}
