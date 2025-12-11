/**
 * 关联操作独立测试
 */

import { ORM, initORM, getORM } from '../core';
import { Table, Column, PrimaryKey, HasOne, HasMany, BelongsTo, ManyToMany } from '../decorator';
import { ColumnType, LogLevel, CascadeType } from '../types';
import { DatabaseAdapter } from '../adapter';

// ========== 实体定义 ==========

@Table()
class RUser {
  @PrimaryKey()
  id?: number;
  @Column()
  name!: string;
  @HasOne(() => RProfile, { foreignKey: 'user_id', cascade: [CascadeType.Create, CascadeType.Update, CascadeType.Delete] })
  profile?: RProfile;
  @HasMany(() => ROrder, { foreignKey: 'user_id', cascade: [CascadeType.Create, CascadeType.Update, CascadeType.Delete] })
  orders?: ROrder[];
}

@Table()
class RProfile {
  @PrimaryKey()
  id?: number;
  @Column({ name: 'user_id', type: ColumnType.INTEGER })
  userId?: number;
  @Column()
  bio?: string;
  @Column()
  avatar?: string;
  @BelongsTo(() => RUser, { foreignKey: 'userId' })
  user?: RUser;
}

@Table()
class ROrder {
  @PrimaryKey()
  id?: number;
  @Column({ name: 'user_id', type: ColumnType.INTEGER })
  userId?: number;
  @Column()
  productName!: string;
  @Column({ type: ColumnType.REAL })
  amount?: number;
  @BelongsTo(() => RUser, { foreignKey: 'userId' })
  user?: RUser;
}

@Table()
class RArticle {
  @PrimaryKey()
  id?: number;
  @Column()
  title!: string;
  @ManyToMany(() => RTag, { through: 'r_article_tag', throughForeignKey: 'article_id', throughOtherKey: 'tag_id', cascade: [CascadeType.Create, CascadeType.Update, CascadeType.Delete] })
  tags?: RTag[];
}

@Table()
class RTag {
  @PrimaryKey()
  id?: number;
  @Column()
  name!: string;
  @ManyToMany(() => RArticle, { through: 'r_article_tag', throughForeignKey: 'tag_id', throughOtherKey: 'article_id' })
  articles?: RArticle[];
}

@Table()
class TDepartment {
  @PrimaryKey()
  id?: number;
  @Column()
  name!: string;
  @HasMany(() => TEmployee, { foreignKey: 'department_id', cascade: [CascadeType.Create, CascadeType.Update, CascadeType.Delete] })
  employees?: TEmployee[];
}

@Table()
class TEmployee {
  @PrimaryKey()
  id?: number;
  @Column()
  name!: string;
  @Column({ name: 'department_id', type: ColumnType.INTEGER })
  departmentId?: number;
  @BelongsTo(() => TDepartment, { foreignKey: 'departmentId' })
  department?: TDepartment;
}

// ========== 测试结果类型 ==========

export class RelationTestResult {
  name: string = '';
  passed: boolean = true;
  error: string = '';
}

export class RelationTestSuite {
  name: string = '';
  results: RelationTestResult[] = [];
}

export class RelationTestStats {
  total: number = 0;
  passed: number = 0;
  failed: number = 0;
}

// ========== 测试运行器 ==========

class RelationTestRunner {
  private suites: RelationTestSuite[] = [];
  private currentSuite: RelationTestSuite | null = null;
  private orm!: ORM;

  constructor(private adapter: DatabaseAdapter) {}

  private describe(name: string, fn: () => void): void {
    const suite = new RelationTestSuite();
    suite.name = name;
    this.currentSuite = suite;
    fn();
    this.suites.push(suite);
    this.currentSuite = null;
  }

  private it(name: string, fn: () => void): void {
    const result = new RelationTestResult();
    result.name = name;
    try {
      fn();
    } catch (e) {
      result.passed = false;
      result.error = (e as Error).message;
    }
    this.currentSuite?.results.push(result);
  }

  private assertEqual<T>(actual: T, expected: T): void {
    if (actual !== expected) throw new Error(`期望 ${expected}，实际 ${actual}`);
  }

  private assertTrue(value: boolean): void {
    if (!value) throw new Error('期望 true，实际 false');
  }

  private assertGreaterThan(actual: number, expected: number): void {
    if (actual <= expected) throw new Error(`期望 ${actual} > ${expected}`);
  }

  run(): RelationTestSuite[] {
    this.suites = [];
    this.orm = initORM({ adapter: this.adapter, logLevel: LogLevel.DEBUG });

    // 迁移（ManyToMany 中间表会自动创建）
    this.orm.migrate(RUser, RProfile, ROrder, RArticle, RTag, TDepartment, TEmployee);

    this.runHasOneTests();
    this.runHasManyTests();
    this.runManyToManyTests();
    this.runCascadeTests();
    this.runLazyLoadingTests();

    return this.suites;
  }

  private runHasOneTests(): void {
    let testUserId = 0;

    this.describe('HasOne 一对一关联测试', () => {
      this.it('1. 级联创建 insertWithRelations', () => {
        const user = new RUser();
        user.name = 'HasOne测试用户';
        user.profile = Object.assign(new RProfile(), { bio: '个人简介', avatar: 'avatar.png' });
        this.orm.insertWithRelations(user);
        testUserId = user.id!;
        this.assertGreaterThan(testUserId, 0);
        const profile = this.orm.query(RProfile).where({ userId: testUserId }).first();
        this.assertTrue(profile !== null);
        this.assertEqual(profile?.bio, '个人简介');
      });

      this.it('2. 预加载查询 with() - first', () => {
        const user = this.orm.query(RUser).with('profile').where({ id: testUserId }).first();
        this.assertTrue(user !== null);
        this.assertTrue(user?.profile !== undefined);
        this.assertEqual(user?.profile?.bio, '个人简介');
      });

      this.it('2.1 预加载查询 with() - find', () => {
        const users = this.orm.query(RUser).with('profile').find();
        this.assertTrue(users.length > 0);
        const user = users.find(u => u.id === testUserId);
        this.assertTrue(user !== undefined);
        this.assertTrue(user?.profile !== undefined);
        this.assertEqual(user?.profile?.bio, '个人简介');
      });

      this.it('3. BelongsTo 反向查询', () => {
        const profile = this.orm.query(RProfile).with('user').where({ userId: testUserId }).first();
        this.assertTrue(profile !== null);
        this.assertTrue(profile?.user !== undefined);
        this.assertEqual(profile?.user?.name, 'HasOne测试用户');
      });

      this.it('4. 级联更新 saveWithRelations', () => {
        const user = this.orm.query(RUser).with('profile').where({ id: testUserId }).first();
        if (user && user.profile) {
          user.name = 'HasOne更新用户';
          user.profile.bio = '更新后的简介';
          this.orm.saveWithRelations(user);
        }
        const updated = this.orm.query(RUser).with('profile').where({ id: testUserId }).first();
        this.assertEqual(updated?.name, 'HasOne更新用户');
        this.assertEqual(updated?.profile?.bio, '更新后的简介');
      });

      this.it('5. 级联删除 deleteWithRelations', () => {
        const user = this.orm.query(RUser).where({ id: testUserId }).first();
        if (user) this.orm.deleteWithRelations(user);
        this.assertEqual(this.orm.query(RUser).where({ id: testUserId }).exists(), false);
        this.assertEqual(this.orm.query(RProfile).where({ userId: testUserId }).exists(), false);
      });
    });
  }

  private runHasManyTests(): void {
    let testUserId = 0;

    this.describe('HasMany 一对多关联测试', () => {
      this.it('1. 级联创建 insertWithRelations', () => {
        const user = new RUser();
        user.name = 'HasMany测试用户';
        user.orders = [
          Object.assign(new ROrder(), { productName: '商品A', amount: 100 }),
          Object.assign(new ROrder(), { productName: '商品B', amount: 200 }),
          Object.assign(new ROrder(), { productName: '商品C', amount: 300 })
        ];
        this.orm.insertWithRelations(user);
        testUserId = user.id!;
        this.assertGreaterThan(testUserId, 0);
        const orders = this.orm.query(ROrder).where({ userId: testUserId }).find();
        this.assertEqual(orders.length, 3);
      });

      this.it('2. 预加载查询 with() - first', () => {
        const user = this.orm.query(RUser).with('orders').where({ id: testUserId }).first();
        this.assertTrue(user !== null);
        this.assertEqual(user?.orders?.length, 3);
      });

      this.it('2.1 预加载查询 with() - find', () => {
        const users = this.orm.query(RUser).with('orders').find();
        this.assertTrue(users.length > 0);
        const user = users.find(u => u.id === testUserId);
        this.assertTrue(user !== undefined);
        this.assertEqual(user?.orders?.length, 3);
      });

      this.it('3. BelongsTo 反向查询', () => {
        const orders = this.orm.query(ROrder).with('user').where({ userId: testUserId }).find();
        this.assertTrue(orders.length > 0);
        this.assertTrue(orders[0]?.user !== undefined);
        this.assertEqual(orders[0]?.user?.name, 'HasMany测试用户');
      });

      this.it('4. 级联更新 saveWithRelations', () => {
        const user = this.orm.query(RUser).with('orders').where({ id: testUserId }).first();
        if (user) {
          user.name = 'HasMany更新用户';
          if (user.orders && user.orders.length > 0) user.orders[0].productName = '更新商品A';
          this.orm.saveWithRelations(user);
        }
        const updated = this.orm.query(RUser).where({ id: testUserId }).first();
        this.assertEqual(updated?.name, 'HasMany更新用户');
      });

      this.it('5. 级联删除 deleteWithRelations', () => {
        const user = this.orm.query(RUser).where({ id: testUserId }).first();
        if (user) this.orm.deleteWithRelations(user);
        this.assertEqual(this.orm.query(RUser).where({ id: testUserId }).exists(), false);
        this.assertEqual(this.orm.query(ROrder).where({ userId: testUserId }).count(), 0);
      });
    });
  }

  private runManyToManyTests(): void {
    let testArticleId = 0;

    this.describe('ManyToMany 多对多关联测试', () => {
      this.it('1. 级联创建 insertWithRelations', () => {
        const article = new RArticle();
        article.title = 'ManyToMany测试文章';
        article.tags = [
          Object.assign(new RTag(), { name: '技术' }),
          Object.assign(new RTag(), { name: '教程' })
        ];
        this.orm.insertWithRelations(article);
        testArticleId = article.id!;
        this.assertGreaterThan(testArticleId, 0);
        // 验证标签已创建并关联
        const loaded = this.orm.query(RArticle).with('tags').where({ id: testArticleId }).first();
        this.assertEqual(loaded?.tags?.length, 2);
      });

      this.it('2. 预加载查询 with() - first', () => {
        const article = this.orm.query(RArticle).with('tags').where({ id: testArticleId }).first();
        this.assertTrue(article !== null);
        this.assertEqual(article?.tags?.length, 2);
      });

      this.it('2.1 预加载查询 with() - find', () => {
        const articles = this.orm.query(RArticle).with('tags').find();
        this.assertTrue(articles.length > 0);
        const article = articles.find(a => a.id === testArticleId);
        this.assertTrue(article !== undefined);
        this.assertEqual(article?.tags?.length, 2);
      });

      this.it('3. 反向预加载查询', () => {
        const article = this.orm.query(RArticle).with('tags').where({ id: testArticleId }).first();
        const tagId = article?.tags?.[0]?.id;
        this.assertTrue(tagId !== undefined);
        const tag = this.orm.query(RTag).with('articles').where({ id: tagId }).first();
        this.assertTrue(tag !== null);
        this.assertTrue((tag?.articles?.length ?? 0) > 0);
      });

      this.it('4. 级联更新 saveWithRelations（同步关联）', () => {
        const article = this.orm.query(RArticle).with('tags').where({ id: testArticleId }).first();
        if (article) {
          article.title = 'ManyToMany更新文章';
          // 替换为新的标签列表（同步操作）
          article.tags = [
            Object.assign(new RTag(), { name: '新标签A' }),
            Object.assign(new RTag(), { name: '新标签B' }),
            Object.assign(new RTag(), { name: '新标签C' })
          ];
          this.orm.saveWithRelations(article);
        }
        const updated = this.orm.query(RArticle).with('tags').where({ id: testArticleId }).first();
        this.assertEqual(updated?.title, 'ManyToMany更新文章');
        this.assertEqual(updated?.tags?.length, 3);
        this.assertTrue(updated?.tags?.some(t => t.name === '新标签A') ?? false);
      });

      this.it('5. 级联删除 deleteWithRelations', () => {
        const article = this.orm.query(RArticle).where({ id: testArticleId }).first();
        if (article) this.orm.deleteWithRelations(article);
        this.assertEqual(this.orm.query(RArticle).where({ id: testArticleId }).exists(), false);
        // 验证中间表关联已删除（通过查询无关联的文章）
        const orphanArticle = this.orm.query(RArticle).with('tags').where({ id: testArticleId }).first();
        this.assertTrue(orphanArticle === null);
      });
    });
  }

  private runCascadeTests(): void {
    let testDeptId = 0;

    this.describe('级联操作综合测试', () => {
      this.it('1. insertWithRelations 级联创建', () => {
        const dept = new TDepartment();
        dept.name = '研发部';
        dept.employees = [
          Object.assign(new TEmployee(), { name: '张三' }),
          Object.assign(new TEmployee(), { name: '李四' })
        ];
        this.orm.insertWithRelations(dept);
        testDeptId = dept.id!;
        this.assertGreaterThan(testDeptId, 0);
        const employees = this.orm.query(TEmployee).where({ departmentId: testDeptId }).find();
        this.assertEqual(employees.length, 2);
      });

      this.it('2. 预加载查询验证 - first', () => {
        const dept = this.orm.query(TDepartment).with('employees').where({ id: testDeptId }).first();
        this.assertTrue(dept !== null);
        this.assertEqual(dept?.employees?.length, 2);
      });

      this.it('2.1 预加载查询验证 - find', () => {
        const depts = this.orm.query(TDepartment).with('employees').find();
        this.assertTrue(depts.length > 0);
        const dept = depts.find(d => d.id === testDeptId);
        this.assertTrue(dept !== undefined);
        this.assertEqual(dept?.employees?.length, 2);
      });

      this.it('3. saveWithRelations 级联更新', () => {
        const dept = this.orm.query(TDepartment).with('employees').where({ id: testDeptId }).first();
        if (dept) {
          dept.name = '技术研发部';
          if (dept.employees && dept.employees.length > 0) {
            dept.employees[0].name = '张三（组长）';
          }
          this.orm.saveWithRelations(dept);
        }
        const updated = this.orm.query(TDepartment).where({ id: testDeptId }).first();
        this.assertEqual(updated?.name, '技术研发部');
      });

      this.it('4. deleteWithRelations 级联删除', () => {
        const dept = this.orm.query(TDepartment).where({ id: testDeptId }).first();
        if (dept) this.orm.deleteWithRelations(dept);
        this.assertEqual(this.orm.query(TDepartment).where({ id: testDeptId }).exists(), false);
        this.assertEqual(this.orm.query(TEmployee).where({ departmentId: testDeptId }).count(), 0);
      });
    });
  }

  private runLazyLoadingTests(): void {
    let testUserId = 0;

    this.describe('lazy() 延迟加载测试', () => {
      this.it('1. 准备测试数据', () => {
        const user = new RUser();
        user.name = 'Lazy测试用户';
        user.profile = Object.assign(new RProfile(), { bio: 'Lazy简介', avatar: 'lazy.png' });
        user.orders = [
          Object.assign(new ROrder(), { productName: 'Lazy商品A', amount: 100 }),
          Object.assign(new ROrder(), { productName: 'Lazy商品B', amount: 200 })
        ];
        this.orm.insertWithRelations(user);
        testUserId = user.id!;
        this.assertGreaterThan(testUserId, 0);
      });

      this.it('2. lazy() HasOne 自动加载', () => {
        const user = this.orm.query(RUser).lazy().where({ id: testUserId }).first();
        this.assertTrue(user !== null);
        // 访问 profile 属性时自动加载
        const profile = user?.profile;
        this.assertTrue(profile !== undefined);
        this.assertEqual(profile?.bio, 'Lazy简介');
      });

      this.it('3. lazy() HasMany 自动加载', () => {
        const user = this.orm.query(RUser).lazy().where({ id: testUserId }).first();
        this.assertTrue(user !== null);
        // 访问 orders 属性时自动加载
        const orders = user?.orders;
        this.assertTrue(orders !== undefined);
        this.assertEqual(orders?.length, 2);
      });

      this.it('4. lazy() BelongsTo 自动加载', () => {
        const order = this.orm.query(ROrder).lazy().where({ userId: testUserId }).first();
        this.assertTrue(order !== null);
        // 访问 user 属性时自动加载
        const user = order?.user;
        this.assertTrue(user !== undefined);
        this.assertEqual(user?.name, 'Lazy测试用户');
      });

      this.it('5. lazy() 缓存验证（多次访问不重复查询）', () => {
        const user = this.orm.query(RUser).lazy().where({ id: testUserId }).first();
        // 第一次访问
        const orders1 = user?.orders;
        // 第二次访问（应返回缓存）
        const orders2 = user?.orders;
        this.assertEqual(orders1, orders2);
      });

      this.it('6. 清理测试数据', () => {
        const user = this.orm.query(RUser).where({ id: testUserId }).first();
        if (user) this.orm.deleteWithRelations(user);
        this.assertEqual(this.orm.query(RUser).where({ id: testUserId }).exists(), false);
      });
    });
  }

  getStats(): RelationTestStats {
    const stats = new RelationTestStats();
    for (const suite of this.suites) {
      for (const result of suite.results) {
        stats.total++;
        if (result.passed) stats.passed++;
      }
    }
    stats.failed = stats.total - stats.passed;
    return stats;
  }
}

// ========== 导出 ==========

let runner: RelationTestRunner | null = null;

export function runRelationTests(adapter: DatabaseAdapter): RelationTestSuite[] {
  runner = new RelationTestRunner(adapter);
  return runner.run();
}

export function getRelationTestStats(): RelationTestStats {
  return runner?.getStats() ?? new RelationTestStats();
}
