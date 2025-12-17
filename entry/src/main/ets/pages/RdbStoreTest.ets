/**
 * RdbStore 适配器测试页面
 * 使用 RelationalStoreAdapter 测试 ORM 功能
 */
import { runAllTests, getTestStats, TestResult, TestSuite, TestStats, IBestORMInit } from '@ibestservices/ibest-orm';
import { getORM, Table, Column as Field, PrimaryKey, ColumnType } from '@ibestservices/ibest-orm';
import { relationalStore } from '@kit.ArkData';

// 使用 @ObservedV2 + @Trace 装饰器（V1 的 @Observed 不支持）
@Table()
@ObservedV2
class ObservedProduct {
  @PrimaryKey()
  id?: number;

  @Field()
  @Trace name: string = '';

  @Field({ type: ColumnType.REAL })
  @Trace price: number = 0;
}

@Entry
@Component
struct RdbStoreTest {
  @State testSuites: TestSuite[] = [];
  @State isRunning: boolean = false;
  @State stats: TestStats = new TestStats();
  @State observedTestResult: string = '';

  build() {
    Column() {
      Text('单元测试 (RdbStore)')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 20, bottom: 20 })

      Row() {
        Button(this.isRunning ? '测试中...' : '运行测试')
          .width('45%')
          .height(50)
          .fontSize(16)
          .enabled(!this.isRunning)
          .onClick(() => this.runTests())

        Button('装饰器兼容测试')
          .width('45%')
          .height(50)
          .fontSize(16)
          .enabled(!this.isRunning)
          .onClick(() => this.runObservedDecoratorTest())
      }
      .width('90%')
      .justifyContent(FlexAlign.SpaceBetween)
      .margin({ bottom: 20 })

      if (this.observedTestResult) {
        Text(this.observedTestResult)
          .fontSize(14)
          .fontColor(this.observedTestResult.includes('失败') ? '#F44336' : '#4CAF50')
          .margin({ bottom: 10 })
          .padding(10)
          .backgroundColor('#fff')
          .borderRadius(8)
          .width('90%')
      }

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
    this.observedTestResult = '';

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

  /**
   * 测试 @ObservedV2 + @Trace 装饰器与 ORM 装饰器混用
   */
  private runObservedDecoratorTest() {
    this.isRunning = true;
    this.observedTestResult = '';

    setTimeout(async () => {
      try {
        await relationalStore.deleteRdbStore(getContext(this), 'test_observed.db');
        await IBestORMInit(getContext(this), { name: 'test_observed.db' });
        const orm = getORM();

        // 调试：输出类信息
        console.info(`[Observed测试] 类名: ${ObservedProduct.name}`);

        // 1. 迁移表
        console.info(`[Observed测试] 开始迁移表...`);
        orm.migrate(ObservedProduct);
        console.info(`[Observed测试] 迁移完成`);

        // 2. 创建实体
        console.info(`[Observed测试] 创建实体...`);
        const product = new ObservedProduct();
        console.info(`[Observed测试] 实体创建完成，constructor.name: ${product.constructor.name}`);
        product.name = '测试商品';
        product.price = 99.9;
        console.info(`[Observed测试] 设置属性完成，准备插入...`);
        console.info(`[Observed测试] product: name=${product.name}, price=${product.price}`);
        orm.insert(product);
        console.info(`[Observed测试] 插入完成，id=${product.id}`);

        if (!product.id || product.id <= 0) {
          throw new Error('插入失败：未获取到ID');
        }

        // 3. 查询并验证
        const queried = orm.query(ObservedProduct).where({ id: product.id }).first();
        if (!queried) {
          throw new Error('查询失败：未找到记录');
        }
        console.log(`[Observed测试] 查询结果：${JSON.stringify(product)}`)
        if (!(queried instanceof ObservedProduct)) {
          throw new Error('类型错误：查询结果不是 ObservedProduct 实例');
        }
        if (queried.name !== '测试商品') {
          throw new Error(`数据错误：name 期望 "测试商品"，实际 "${queried.name}"`);
        }

        // 4. 更新
        queried.name = '更新商品';
        queried.price = 199.9;
        orm.save(queried);

        const updated = orm.query(ObservedProduct).where({ id: product.id }).first();
        if (updated?.name !== '更新商品' || updated?.price !== 199.9) {
          throw new Error('更新失败');
        }

        // 5. 删除
        orm.query(ObservedProduct).where({ id: product.id }).delete();
        const deleted = orm.query(ObservedProduct).where({ id: product.id }).first();
        if (deleted) {
          throw new Error('删除失败');
        }

        this.observedTestResult = '✓ @ObservedV2 + @Trace 装饰器兼容性测试通过！\n创建、查询、更新、删除均正常';
      } catch (e) {
        this.observedTestResult = `✗ 测试失败: ${(e as Error).message}`;
        console.error('装饰器兼容性测试失败:', e);
      } finally {
        this.isRunning = false;
      }
    }, 100);
  }
}
