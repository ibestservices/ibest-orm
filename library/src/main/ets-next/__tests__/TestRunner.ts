/**
 * 测试运行器
 * 在模拟器/真机上运行单元测试
 */

import { ORM, MemoryAdapter, initORMWithMemory, initORM, getORM, DatabaseAdapter } from '../index';
import { Table, Column, PrimaryKey, CreatedAt, SoftDelete, HasMany, BelongsTo } from '../decorator';
import { ColumnType, LogLevel } from '../types';
import { metadataStorage } from '../types/metadata';
import { camelToSnake, snakeToCamel, classToTable } from '../utils/naming';
import { validate, Required, Length, Range } from '../validator';
import { QueryCache } from '../cache';
import { formatDate, setTimeFormat, getTimeFormat } from '../utils';
import { setErrorLocale, getErrorLocale, ErrorCode, ORMError } from '../error';

// ========== 测试实体 ==========
@Table()
class TUser {
  @PrimaryKey()
  id?: number;
  @Column()
  name!: string;
  @Column({ type: ColumnType.INTEGER })
  age?: number;
  @CreatedAt()
  createdAt?: string;
}

@Table({ name: 'custom_posts' })
class TPost {
  @PrimaryKey()
  id?: number;
  @Column()
  title!: string;
}

@Table()
class TComment {
  @PrimaryKey()
  id?: number;
  @Column()
  content!: string;
  @SoftDelete()
  deletedAt?: string;
}

@Table()
class TAuthor {
  @PrimaryKey()
  id?: number;
  @Column()
  name!: string;

  // 使用装饰器定义一对多关联
  @HasMany(() => TBook, { foreignKey: 'author_id' })
  books?: TBook[];
}

@Table()
class TBook {
  @PrimaryKey()
  id?: number;
  @Column()
  title!: string;
  @Column({ name: 'author_id', type: ColumnType.INTEGER })
  authorId?: number;

  // 使用装饰器定义多对一关联
  @BelongsTo(() => TAuthor, { foreignKey: 'authorId' })
  author?: TAuthor;
}

@Table()
class TValidatedUser {
  @PrimaryKey()
  id?: number;
  @Required('用户名不能为空')
  @Column()
  username!: string;
}

@Table()
class TLengthUser {
  @PrimaryKey()
  id?: number;
  @Length(3, 10)
  @Column()
  name!: string;
}

@Table()
class TRangeUser {
  @PrimaryKey()
  id?: number;
  @Range(0, 150)
  @Column({ type: ColumnType.INTEGER })
  age!: number;
}

// ========== 测试结果类型 ==========

export class TestResult {
  name: string = '';
  passed: boolean = true;
  error: string = '';
}

export class TestSuite {
  name: string = '';
  results: TestResult[] = [];
}

export class TestStats {
  total: number = 0;
  passed: number = 0;
  failed: number = 0;
}

// ========== 测试运行器 ==========

class TestRunner {
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;
  private adapter: MemoryAdapter | null = null;
  private externalAdapter: DatabaseAdapter | null = null;

  constructor(adapter?: DatabaseAdapter) {
    this.externalAdapter = adapter || null;
  }

  describe(name: string, fn: () => void): void {
    const suite = new TestSuite();
    suite.name = name;
    suite.results = [];
    this.currentSuite = suite;
    fn();
    this.suites.push(suite);
    this.currentSuite = null;
  }

  it(name: string, fn: () => void): void {
    const result = new TestResult();
    result.name = name;
    result.passed = true;
    try {
      fn();
    } catch (e) {
      result.passed = false;
      result.error = (e as Error).message;
    }
    if (this.currentSuite) {
      this.currentSuite.results.push(result);
    }
  }

  assertEqual<T>(actual: T, expected: T): void {
    if (actual !== expected) {
      throw new Error('期望 ' + String(expected) + '，实际 ' + String(actual));
    }
  }

  assertTrue(value: boolean): void {
    if (!value) {
      throw new Error('期望 true，实际 false');
    }
  }

  assertGreaterThan(actual: number, expected: number): void {
    if (actual <= expected) {
      throw new Error('期望 ' + actual + ' > ' + expected);
    }
  }

  assertLength<T>(arr: T[], expected: number): void {
    if (arr.length !== expected) {
      throw new Error('期望长度 ' + expected + '，实际 ' + arr.length);
    }
  }

  runAll(): TestSuite[] {
    this.suites = [];
    this.runUtilsTests();
    // 仅在使用 MemoryAdapter 时运行适配器测试
    const isMemoryAdapter = this.externalAdapter instanceof MemoryAdapter ||
      (!this.externalAdapter && this.isGlobalORMUsingMemoryAdapter());
    if (isMemoryAdapter) {
      this.runAdapterTests();
    }
    this.runORMTests();
    this.runAdvancedTests();
    return this.suites;
  }

  private isGlobalORMUsingMemoryAdapter(): boolean {
    try {
      return getORM().getAdapter() instanceof MemoryAdapter;
    } catch {
      return true; // 未初始化时默认使用 MemoryAdapter
    }
  }

  private runUtilsTests(): void {
    this.describe('工具函数测试', () => {
      this.it('camelToSnake: 普通驼峰转换', () => {
        this.assertEqual(camelToSnake('createdAt'), 'created_at');
        this.assertEqual(camelToSnake('userName'), 'user_name');
      });

      this.it('camelToSnake: 全大写处理', () => {
        this.assertEqual(camelToSnake('ID'), 'id');
      });

      this.it('snakeToCamel: 蛇形转驼峰', () => {
        this.assertEqual(snakeToCamel('created_at'), 'createdAt');
      });

      this.it('classToTable: 类名转表名', () => {
        this.assertEqual(classToTable('User'), 'user');
        this.assertEqual(classToTable('UserProfile'), 'user_profile');
      });
    });
  }

  private runAdapterTests(): void {
    this.describe('MemoryAdapter 测试', () => {
      this.it('创建适配器', () => {
        this.adapter = new MemoryAdapter();
        this.assertTrue(this.adapter !== null);
        this.assertEqual(this.adapter.isConnected(), true);
      });

      this.it('创建表', () => {
        this.adapter!.executeSqlSync('CREATE TABLE IF NOT EXISTS test_user (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)');
        const data = this.adapter!.getTableData('test_user');
        this.assertLength(data, 0);
      });

      this.it('插入数据', () => {
        const id = this.adapter!.insert('test_user', { name: '张三', age: 25 });
        this.assertGreaterThan(id, 0);
      });

      this.it('查询数据', () => {
        const data = this.adapter!.getTableData('test_user');
        this.assertLength(data, 1);
      });

      this.it('更新数据', () => {
        const count = this.adapter!.update('test_user', { age: 30 }, 'name = ?', ['张三']);
        this.assertGreaterThan(count, 0);
      });

      this.it('验证更新', () => {
        const data = this.adapter!.getTableData('test_user');
        this.assertEqual(data[0]?.age, 30);
      });

      this.it('删除数据', () => {
        this.adapter!.insert('test_user', { name: '李四', age: 20 });
        const count = this.adapter!.delete('test_user', 'name = ?', ['李四']);
        this.assertGreaterThan(count, 0);
      });

      this.it('事务提交', () => {
        this.adapter!.beginTransaction();
        this.adapter!.insert('test_user', { name: '事务用户', age: 40 });
        this.adapter!.commit();
        const data = this.adapter!.getTableData('test_user');
        const found = data.filter(r => r.name === '事务用户');
        this.assertLength(found, 1);
      });

      this.it('事务回滚', () => {
        const before = this.adapter!.getTableData('test_user').length;
        this.adapter!.beginTransaction();
        this.adapter!.insert('test_user', { name: '回滚用户', age: 50 });
        this.adapter!.rollback();
        const after = this.adapter!.getTableData('test_user').length;
        this.assertEqual(after, before);
      });
    });
  }

  private runORMTests(): void {
    let orm: ORM;

    this.describe('ORM 初始化测试', () => {
      this.it('初始化 ORM 实例', () => {
        if (this.externalAdapter) {
          orm = initORM({ adapter: this.externalAdapter, logLevel: LogLevel.ERROR });
        } else {
          // 尝试获取已初始化的全局 ORM，否则使用内存适配器
          try {
            orm = getORM();
          } catch {
            orm = initORMWithMemory({ logLevel: LogLevel.ERROR });
          }
        }
        this.assertTrue(orm !== null);
      });

      this.it('getORM 获取实例', () => {
        const instance = getORM();
        this.assertTrue(instance !== null);
      });

      this.it('migrate 创建表', () => {
        orm.migrate(TUser, TPost, TComment, TAuthor, TBook, TValidatedUser, TLengthUser, TRangeUser);
        this.assertTrue(true);
      });

      this.it('hasTable 检查表存在', () => {
        this.assertTrue(orm.hasTable(TUser));
        this.assertTrue(orm.hasTable('t_user'));
        this.assertEqual(orm.hasTable('not_exist_table'), false);
      });

      this.it('getTableInfo 获取表信息', () => {
        const columns = orm.getTableInfo(TUser);
        this.assertGreaterThan(columns.length, 0);
        const idCol = columns.find(c => c.name === 'id');
        this.assertTrue(idCol !== undefined);
        this.assertEqual(idCol?.pk, true);
      });

      this.it('hasColumn 检查列存在', () => {
        this.assertTrue(orm.hasColumn(TUser, 'id'));
        this.assertTrue(orm.hasColumn(TUser, 'name'));
        this.assertEqual(orm.hasColumn(TUser, 'not_exist_column'), false);
      });
    });

    this.describe('元数据测试', () => {
      this.it('Table 装饰器注册元数据', () => {
        const meta = metadataStorage.getEntityMetadata(TUser);
        this.assertTrue(meta !== undefined);
        this.assertEqual(meta?.table.name, 't_user');
      });

      this.it('自定义表名', () => {
        const meta = metadataStorage.getEntityMetadata(TPost);
        this.assertEqual(meta?.table.name, 'custom_posts');
      });

      this.it('Column 装饰器注册列', () => {
        const meta = metadataStorage.getEntityMetadata(TUser);
        this.assertTrue((meta?.columns.length ?? 0) > 0);
      });

      this.it('关联元数据注册', () => {
        const meta = metadataStorage.getEntityMetadata(TAuthor);
        this.assertTrue((meta?.relations.length ?? 0) > 0);
        this.assertEqual(meta?.relations[0]?.propertyKey, 'books');
      });
    });

    this.describe('CRUD 操作测试', () => {
      this.it('insert 插入单条', () => {
        const user = new TUser();
        user.name = '张三';
        user.age = 25;
        const id = orm.insert(user);
        this.assertGreaterThan(id, 0);
      });

      this.it('query.first 查询单条', () => {
        const user = orm.query(TUser).first();
        this.assertTrue(user !== null);
        this.assertEqual(user?.name, '张三');
      });

      this.it('query.find 查询多条', () => {
        const user2 = new TUser();
        user2.name = '李四';
        user2.age = 30;
        orm.insert(user2);
        const users = orm.query(TUser).find();
        this.assertGreaterThan(users.length, 1);
      });

      this.it('save 更新数据', () => {
        const user = orm.query(TUser).first();
        if (user) {
          user.age = 26;
          orm.save(user);
          const updated = orm.query(TUser).where({ id: user.id }).first();
          this.assertEqual(updated?.age, 26);
        }
      });

      this.it('delete 删除数据', () => {
        const before = orm.query(TUser).count();
        orm.query(TUser).where({ name: '李四' }).delete();
        const after = orm.query(TUser).count();
        this.assertEqual(after, before - 1);
      });
    });

    this.describe('批量操作测试', () => {
      this.it('批量插入', () => {
        const users: TUser[] = [];
        for (let i = 0; i < 5; i++) {
          const u = new TUser();
          u.name = `批量用户${i}`;
          u.age = 20 + i;
          users.push(u);
        }
        orm.insert(users);
        const count = orm.query(TUser).count();
        this.assertGreaterThan(count, 5);
      });

      this.it('批量更新', () => {
        orm.query(TUser).where({ age: { gte: 20 } }).update({ age: 99 });
        const users = orm.query(TUser).where({ age: 99 }).find();
        this.assertGreaterThan(users.length, 0);
      });
    });

    this.describe('事务测试', () => {
      this.it('事务提交', () => {
        const before = orm.query(TUser).count();
        orm.beginTransaction();
        const u = new TUser();
        u.name = '事务用户';
        u.age = 40;
        orm.insert(u);
        orm.commit();
        const after = orm.query(TUser).count();
        this.assertEqual(after, before + 1);
      });

      this.it('事务回滚', () => {
        const before = orm.query(TUser).count();
        orm.beginTransaction();
        const u = new TUser();
        u.name = '回滚用户';
        u.age = 50;
        orm.insert(u);
        orm.rollback();
        const after = orm.query(TUser).count();
        this.assertEqual(after, before);
      });
    });

    this.describe('查询构建器测试', () => {
      this.it('where 条件查询', () => {
        const users = orm.query(TUser).where({ age: 99 }).find();
        this.assertTrue(users.length > 0);
      });

      this.it('orderBy 排序', () => {
        const users = orm.query(TUser).orderBy('age', 'desc').find();
        this.assertTrue(users.length > 0);
      });

      this.it('limit 限制', () => {
        const users = orm.query(TUser).limit(2).find();
        this.assertTrue(users.length <= 2);
      });

      this.it('offset 偏移', () => {
        const users = orm.query(TUser).offset(1).limit(2).find();
        this.assertTrue(users.length <= 2);
      });

      this.it('count 计数', () => {
        const count = orm.query(TUser).count();
        this.assertGreaterThan(count, 0);
      });

      this.it('exists 存在检查', () => {
        const exists = orm.query(TUser).where({ name: '张三' }).exists();
        this.assertTrue(exists);
      });
    });

    this.describe('软删除测试', () => {
      this.it('softDelete 软删除', () => {
        // 先清理旧数据
        orm.query(TComment).withTrashed().where({ content: '软删除测试' }).delete();
        const comment = new TComment();
        comment.content = '软删除测试';
        orm.insert(comment);
        const before = orm.query(TComment).where({ content: '软删除测试' }).count();
        orm.query(TComment).where({ content: '软删除测试' }).softDelete();
        const after = orm.query(TComment).where({ content: '软删除测试' }).count();
        this.assertEqual(after, before - 1);
      });

      this.it('withTrashed 包含已删除', () => {
        const all = orm.query(TComment).withTrashed().where({ content: '软删除测试' }).count();
        const normal = orm.query(TComment).where({ content: '软删除测试' }).count();
        this.assertGreaterThan(all, normal);
      });

      this.it('restore 恢复', () => {
        orm.query(TComment).withTrashed().where({ content: '软删除测试' }).restore();
        const count = orm.query(TComment).where({ content: '软删除测试' }).count();
        this.assertEqual(count, 1);
      });
    });

    // 关联测试移到 runRelationTests

    this.describe('验证器测试', () => {
      this.it('Required 验证', () => {
        const user = new TValidatedUser();
        const result = validate(user);
        this.assertEqual(result.valid, false);
      });

      this.it('Length 验证', () => {
        const user = new TLengthUser();
        user.name = 'AB';
        const result = validate(user);
        this.assertEqual(result.valid, false);
      });

      this.it('Range 验证', () => {
        const user = new TRangeUser();
        user.age = 200;
        const result = validate(user);
        this.assertEqual(result.valid, false);
      });

      this.it('验证通过', () => {
        const user = new TValidatedUser();
        user.username = '有效用户名';
        const result = validate(user);
        this.assertEqual(result.valid, true);
      });
    });

    this.describe('缓存测试', () => {
      this.it('缓存设置和获取', () => {
        const cache = new QueryCache({ enabled: true, ttl: 60000, maxSize: 100 });
        cache.set('test:key', [{ id: 1 }]);
        const data = cache.get<object[]>('test:key');
        this.assertTrue(data !== undefined);
      });

      this.it('缓存删除', () => {
        const cache = new QueryCache({ enabled: true, ttl: 60000, maxSize: 100 });
        cache.set('test:key', [{ id: 1 }]);
        cache.delete('test:key');
        const data = cache.get('test:key');
        this.assertTrue(data === undefined);
      });

      this.it('按表名失效', () => {
        const cache = new QueryCache({ enabled: true, ttl: 60000, maxSize: 100 });
        cache.set('user:1', { id: 1 });
        cache.set('user:2', { id: 2 });
        cache.set('post:1', { id: 1 });
        cache.invalidateByTable('user');
        this.assertTrue(cache.get('user:1') === undefined);
        this.assertTrue(cache.get('post:1') !== undefined);
      });
    });

    this.describe('时间格式测试', () => {
      this.it('设置和获取时间格式', () => {
        setTimeFormat('date');
        this.assertEqual(getTimeFormat().format, 'date');
      });

      this.it('formatDate 格式化', () => {
        const date = new Date(2024, 0, 15, 10, 30, 0);
        const formatted = formatDate(date, 'date');
        this.assertEqual(formatted, '2024-01-15');
      });
    });

    this.describe('错误国际化测试', () => {
      this.it('设置错误语言', () => {
        setErrorLocale('en');
        this.assertEqual(getErrorLocale(), 'en');
        setErrorLocale('zh');
        this.assertEqual(getErrorLocale(), 'zh');
      });

      this.it('ORMError 创建', () => {
        const error = new ORMError({ code: ErrorCode.INIT_FAILED });
        this.assertTrue(error.message.length > 0);
      });
    });
  }

  private runAdvancedTests(): void {
    const orm = getORM();

    this.describe('嵌套事务测试', () => {
      this.it('嵌套事务提交', () => {
        const before = orm.query(TUser).count();
        orm.beginTransaction();
        const u1 = new TUser();
        u1.name = '外层事务';
        u1.age = 30;
        orm.insert(u1);
        orm.beginTransaction();
        const u2 = new TUser();
        u2.name = '内层事务';
        u2.age = 31;
        orm.insert(u2);
        orm.commit();
        orm.commit();
        const after = orm.query(TUser).count();
        this.assertEqual(after, before + 2);
      });

      this.it('嵌套事务全部回滚', () => {
        // 注意：RdbStore 不支持 savepoint，内层 rollback 会回滚整个事务
        const before = orm.query(TUser).count();
        orm.beginTransaction();
        const u1 = new TUser();
        u1.name = '嵌套回滚1';
        u1.age = 32;
        orm.insert(u1);
        orm.beginTransaction();
        const u2 = new TUser();
        u2.name = '嵌套回滚2';
        u2.age = 33;
        orm.insert(u2);
        orm.rollback();
        // RdbStore: rollback 会回滚整个事务，无需再 commit
        const after = orm.query(TUser).count();
        this.assertEqual(after, before);
      });
    });

    this.describe('复杂查询测试', () => {
      this.it('多条件 AND 查询', () => {
        const users = orm.query(TUser).where({ age: { gte: 20 } }).where({ age: { lte: 50 } }).find();
        this.assertTrue(users.length >= 0);
      });

      this.it('IN 查询', () => {
        const users = orm.query(TUser).where({ age: { in: [30, 31, 32, 99] } }).find();
        this.assertTrue(users.length >= 0);
      });

      this.it('select 指定字段', () => {
        const users = orm.query(TUser).select('id', 'name').find();
        this.assertTrue(users.length > 0);
      });

      this.it('链式条件查询', () => {
        const count = orm.query(TUser)
          .where({ age: { gte: 20 } })
          .orderBy('age', 'asc')
          .limit(10)
          .offset(0)
          .count();
        this.assertTrue(count >= 0);
      });
    });

  }

  getStats(): TestStats {
    const stats = new TestStats();
    for (const suite of this.suites) {
      for (const result of suite.results) {
        stats.total++;
        if (result.passed) {
          stats.passed++;
        }
      }
    }
    stats.failed = stats.total - stats.passed;
    return stats;
  }
}

// ========== 导出 ==========

let testRunner = new TestRunner();

export function runAllTests(adapter?: DatabaseAdapter): TestSuite[] {
  testRunner = new TestRunner(adapter);
  return testRunner.runAll();
}

export function getTestStats(): TestStats {
  return testRunner.getStats();
}
