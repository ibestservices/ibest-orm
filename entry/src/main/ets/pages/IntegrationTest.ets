/**
 * 集成测试和性能测试页面
 * 使用 RdbStore 进行完整业务流程测试
 */
import { runAllIntegrationTests, IntegrationTestStats, PerformanceResult, createRelationalStoreAdapter } from '@ibestservices/ibest-orm';
import { relationalStore } from '@kit.ArkData';

@Entry
@Component
struct IntegrationTest {
  @State stats: IntegrationTestStats | null = null;
  @State isRunning: boolean = false;
  @State logs: string[] = [];

  build() {
    Column() {
      Text('集成测试 (RdbStore)')
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

      if (this.stats) {
        Row() {
          Text(`总计: ${this.stats.totalTests}`).fontSize(16).margin({ right: 20 })
          Text(`通过: ${this.stats.passed}`).fontSize(16).fontColor('#4CAF50').margin({ right: 20 })
          Text(`失败: ${this.stats.failed}`).fontSize(16).fontColor(this.stats.failed > 0 ? '#F44336' : '#999')
        }.margin({ bottom: 20 })

        if (this.stats.performance.length > 0) {
          Text('性能测试结果')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .margin({ bottom: 10 })

          List() {
            ForEach(this.stats.performance, (perf: PerformanceResult) => {
              ListItem() {
                Row() {
                  Text(perf.name).fontSize(14).layoutWeight(1)
                  Text(`${perf.opsPerSecond} ops/s`).fontSize(14).fontColor('#2196F3')
                }
                .width('100%')
                .padding({ left: 16, right: 16, top: 12, bottom: 12 })
              }
            })
          }
          .width('90%')
          .height(200)
          .backgroundColor('#f5f5f5')
          .borderRadius(8)
          .margin({ bottom: 20 })
        }
      }

      List() {
        ForEach(this.logs, (log: string) => {
          ListItem() {
            Text(log)
              .fontSize(12)
              .fontColor(log.includes('✗') ? '#F44336' : (log.includes('✓') ? '#4CAF50' : '#333'))
              .padding({ left: 16, right: 16, top: 4, bottom: 4 })
          }
        })
      }
      .width('100%')
      .layoutWeight(1)
      .backgroundColor('#fafafa')
    }
    .width('100%')
    .height('100%')
  }

  runTests() {
    this.isRunning = true;
    this.logs = ['开始运行集成测试...'];
    this.stats = null;

    setTimeout(async () => {
      try {
        // 删除旧数据库，确保每次测试从干净状态开始
        await relationalStore.deleteRdbStore(getContext(this), 'test_integration.db');
        const adapter = await createRelationalStoreAdapter(getContext(this), { name: 'test_integration.db' });
        const result = runAllIntegrationTests(adapter);
        this.stats = result;
        this.logs.push('');
        this.logs.push(`=== 测试完成 ===`);
        this.logs.push(`通过: ${result.passed}/${result.totalTests}`);

        if (result.performance.length > 0) {
          this.logs.push('');
          this.logs.push('=== 性能测试 ===');
          result.performance.forEach(p => {
            this.logs.push(`${p.name}: ${p.opsPerSecond} ops/s (${p.totalTime}ms)`);
          });
        }
      } catch (e) {
        this.logs.push(`错误: ${(e as Error).message}`);
      }
      this.isRunning = false;
    }, 100);
  }
}
