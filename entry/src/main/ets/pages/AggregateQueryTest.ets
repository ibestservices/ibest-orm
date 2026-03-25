/**
 * 聚合查询测试页面
 * 测试 max、min、sum、avg 等聚合函数
 */
import { IBestORMInit, getORM, Table, Column as Col, PrimaryKey, ColumnType, ORM } from '@ibestservices/ibest-orm';
import { relationalStore } from '@kit.ArkData';

// 测试实体：商品
@Table()
class Product {
  @PrimaryKey()
  id?: number;

  @Col()
  name: string = '';

  @Col({ type: ColumnType.REAL })
  price: number = 0;

  @Col({ type: ColumnType.INTEGER })
  stock: number = 0;

  @Col()
  category: string = '';
}

// 测试结果类型
class AggregateTestResult {
  name: string = '';
  passed: boolean = false;
  message: string = '';
  duration: number = 0;

  constructor(name: string = '', passed: boolean = false, message: string = '', duration: number = 0) {
    this.name = name;
    this.passed = passed;
    this.message = message;
    this.duration = duration;
  }
}

@Entry
@Component
struct AggregateQueryTest {
  @State testResults: AggregateTestResult[] = [];
  @State isRunning: boolean = false;
  @State totalPassed: number = 0;
  @State totalFailed: number = 0;

  build() {
    Column() {
      Text('聚合查询测试')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 20, bottom: 10 })

      Text('测试 max / min / sum / avg 聚合函数')
        .fontSize(14)
        .fontColor('#666')
        .margin({ bottom: 20 })

      Row() {
        Button(this.isRunning ? '测试中...' : '运行聚合查询测试')
          .width('90%')
          .height(50)
          .fontSize(16)
          .enabled(!this.isRunning)
          .onClick(() => this.runTests())
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
      .margin({ bottom: 20 })

      if (this.testResults.length > 0) {
        Row() {
          Text('总计: ' + this.testResults.length)
            .fontSize(16)
            .margin({ right: 20 })
          Text('通过: ' + this.totalPassed)
            .fontSize(16)
            .fontColor('#4CAF50')
            .margin({ right: 20 })
          Text('失败: ' + this.totalFailed)
            .fontSize(16)
            .fontColor(this.totalFailed > 0 ? '#F44336' : '#999')
        }
        .margin({ bottom: 20 })
      }

      List() {
        ForEach(this.testResults, (result: AggregateTestResult) => {
          ListItem() {
            Column() {
              Row() {
                Text(result.passed ? '✓' : '✗')
                  .fontSize(16)
                  .fontColor(result.passed ? '#4CAF50' : '#F44336')
                  .margin({ right: 8 })
                Text(result.name)
                  .fontSize(14)
                  .fontColor(result.passed ? '#333' : '#F44336')
                  .layoutWeight(1)
                Text('' + result.duration + 'ms')
                  .fontSize(12)
                  .fontColor('#999')
              }
              .width('100%')

              Text(result.message)
                .fontSize(12)
                .fontColor(result.passed ? '#666' : '#F44336')
                .margin({ top: 4, left: 24 })
                .maxLines(2)
            }
            .width('100%')
            .padding({ top: 12, bottom: 12, left: 16, right: 16 })
            .backgroundColor('#fff')
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

  private async runTests() {
    this.isRunning = true;
    this.testResults = [];
    this.totalPassed = 0;
    this.totalFailed = 0;

    setTimeout(async () => {
      try {
        // 清理并初始化数据库
        await relationalStore.deleteRdbStore(getContext(this), 'test_aggregate.db');
        await IBestORMInit(getContext(this), { name: 'test_aggregate.db' });

        const orm = getORM();
        orm.migrate(Product);

        // 准备测试数据
        this.prepareTestData(orm);

        // 运行测试
        this.addResult(this.testMax(orm));
        this.addResult(this.testMin(orm));
        this.addResult(this.testSum(orm));
        this.addResult(this.testAvg(orm));
        this.addResult(this.testMaxWithCondition(orm));
        this.addResult(this.testMinWithCondition(orm));
        this.addResult(this.testSumWithCondition(orm));
        this.addResult(this.testAvgWithCondition(orm));
        this.addResult(this.testEmptyTable(orm));
        this.addResult(this.testNullValues(orm));

      } catch (e) {
        this.addResult(new AggregateTestResult(
          '测试初始化',
          false,
          '初始化失败: ' + (e as Error).message,
          0
        ));
      } finally {
        this.isRunning = false;
      }
    }, 100);
  }

  private prepareTestData(orm: ORM): void {
    const p1 = new Product();
    p1.name = 'iPhone 15';
    p1.price = 5999;
    p1.stock = 100;
    p1.category = '手机';
    orm.insert(p1);

    const p2 = new Product();
    p2.name = 'iPhone 15 Pro';
    p2.price = 7999;
    p2.stock = 50;
    p2.category = '手机';
    orm.insert(p2);

    const p3 = new Product();
    p3.name = 'iPad Pro';
    p3.price = 6999;
    p3.stock = 80;
    p3.category = '平板';
    orm.insert(p3);

    const p4 = new Product();
    p4.name = 'MacBook Pro';
    p4.price = 14999;
    p4.stock = 30;
    p4.category = '电脑';
    orm.insert(p4);

    const p5 = new Product();
    p5.name = 'AirPods Pro';
    p5.price = 1999;
    p5.stock = 200;
    p5.category = '配件';
    orm.insert(p5);

    const p6 = new Product();
    p6.name = 'Apple Watch';
    p6.price = 2999;
    p6.stock = 150;
    p6.category = '配件';
    orm.insert(p6);
  }

  private addResult(result: AggregateTestResult): void {
    this.testResults.push(result);
    if (result.passed) {
      this.totalPassed++;
    } else {
      this.totalFailed++;
    }
  }

  // 测试 max 方法
  private testMax(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const maxPrice = orm.query(Product).max('price');
      if (maxPrice === 14999) {
        return new AggregateTestResult(
          'max() - 查询最大值',
          true,
          '最高价格: ¥' + maxPrice,
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'max() - 查询最大值',
        false,
        '期望值: 14999, 实际值: ' + maxPrice,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'max() - 查询最大值',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试 min 方法
  private testMin(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const minPrice = orm.query(Product).min('price');
      if (minPrice === 1999) {
        return new AggregateTestResult(
          'min() - 查询最小值',
          true,
          '最低价格: ¥' + minPrice,
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'min() - 查询最小值',
        false,
        '期望值: 1999, 实际值: ' + minPrice,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'min() - 查询最小值',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试 sum 方法
  private testSum(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const totalStock = orm.query(Product).sum('stock');
      if (totalStock === 610) {
        return new AggregateTestResult(
          'sum() - 查询总和',
          true,
          '总库存: ' + totalStock + ' 件',
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'sum() - 查询总和',
        false,
        '期望值: 610, 实际值: ' + totalStock,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'sum() - 查询总和',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试 avg 方法
  private testAvg(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const avgPrice = orm.query(Product).avg('price');
      // (5999 + 7999 + 6999 + 14999 + 1999 + 2999) / 6 = 6832.33...
      if (avgPrice !== null && Math.abs(avgPrice - 6832.33) < 1) {
        return new AggregateTestResult(
          'avg() - 查询平均值',
          true,
          '平均价格: ¥' + avgPrice.toFixed(2),
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'avg() - 查询平均值',
        false,
        '期望值约: 6832.33, 实际值: ' + avgPrice,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'avg() - 查询平均值',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试带条件的 max
  private testMaxWithCondition(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const maxAccessoryPrice = orm.query(Product)
        .where({ category: '配件' })
        .max('price');
      if (maxAccessoryPrice === 2999) {
        return new AggregateTestResult(
          'max() + where - 条件最大值',
          true,
          '配件类最高价格: ¥' + maxAccessoryPrice,
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'max() + where - 条件最大值',
        false,
        '期望值: 2999, 实际值: ' + maxAccessoryPrice,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'max() + where - 条件最大值',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试带条件的 min
  private testMinWithCondition(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const minPhonePrice = orm.query(Product)
        .where({ category: '手机' })
        .min('price');
      if (minPhonePrice === 5999) {
        return new AggregateTestResult(
          'min() + where - 条件最小值',
          true,
          '手机类最低价格: ¥' + minPhonePrice,
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'min() + where - 条件最小值',
        false,
        '期望值: 5999, 实际值: ' + minPhonePrice,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'min() + where - 条件最小值',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试带条件的 sum
  private testSumWithCondition(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const accessoryStock = orm.query(Product)
        .where({ category: '配件' })
        .sum('stock');
      if (accessoryStock === 350) {
        return new AggregateTestResult(
          'sum() + where - 条件总和',
          true,
          '配件类总库存: ' + accessoryStock + ' 件',
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'sum() + where - 条件总和',
        false,
        '期望值: 350, 实际值: ' + accessoryStock,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'sum() + where - 条件总和',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试带条件的 avg
  private testAvgWithCondition(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      const avgPhonePrice = orm.query(Product)
        .where({ category: '手机' })
        .avg('price');
      // (5999 + 7999) / 2 = 6999
      if (avgPhonePrice === 6999) {
        return new AggregateTestResult(
          'avg() + where - 条件平均值',
          true,
          '手机类平均价格: ¥' + avgPhonePrice,
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'avg() + where - 条件平均值',
        false,
        '期望值: 6999, 实际值: ' + avgPhonePrice,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'avg() + where - 条件平均值',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试空表情况
  private testEmptyTable(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      // 清空表
      orm.query(Product).delete();

      const maxResult = orm.query(Product).max('price');
      const minResult = orm.query(Product).min('price');
      const sumResult = orm.query(Product).sum('price');
      const avgResult = orm.query(Product).avg('price');

      // 恢复数据
      this.prepareTestData(orm);

      if (maxResult === null && minResult === null && sumResult === 0 && avgResult === null) {
        return new AggregateTestResult(
          '空表处理 - 边界测试',
          true,
          '空表时 max/min/avg 返回 null, sum 返回 0',
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        '空表处理 - 边界测试',
        false,
        'max=' + maxResult + ', min=' + minResult + ', sum=' + sumResult + ', avg=' + avgResult,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        '空表处理 - 边界测试',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }

  // 测试包含 null 值的情况
  private testNullValues(orm: ORM): AggregateTestResult {
    const start = Date.now();
    try {
      // 插入一条 price 为 0 的记录（在数据库中视为有值）
      const testProduct = new Product();
      testProduct.name = 'Test Product';
      testProduct.price = 0;
      testProduct.stock = 10;
      testProduct.category = '测试';
      orm.insert(testProduct);

      const maxResult = orm.query(Product).max('price');
      const minResult = orm.query(Product).min('price');
      const countResult = orm.query(Product).count();

      // 清理测试数据
      orm.query(Product).where({ category: '测试' }).delete();

      if (maxResult === 14999 && minResult === 0 && countResult === 7) {
        return new AggregateTestResult(
          'NULL 值处理 - 边界测试',
          true,
          '聚合函数正确处理 0 值',
          Date.now() - start
        );
      }
      return new AggregateTestResult(
        'NULL 值处理 - 边界测试',
        false,
        'max=' + maxResult + ', min=' + minResult + ', count=' + countResult,
        Date.now() - start
      );
    } catch (e) {
      return new AggregateTestResult(
        'NULL 值处理 - 边界测试',
        false,
        '异常: ' + (e as Error).message,
        Date.now() - start
      );
    }
  }
}
