/**
 * 集成测试和性能测试
 */

import { ORM, initORMWithMemory, initORM, getORM } from '../core';
import { Table, Column, PrimaryKey, CreatedAt, UpdatedAt, SoftDelete, NotNull, HasMany, BelongsTo } from '../decorator';
import { ColumnType, LogLevel, RelationType } from '../types';
import { metadataStorage, RelationMetadata } from '../types/metadata';
import { MemoryAdapter, DatabaseAdapter } from '../adapter';
import { validate, Required, Length, Range, Email, Min, Max } from '../validator';
import { QueryCache, initQueryCache, getQueryCache } from '../cache';
import { setTimeFormat, getTimeFormat } from '../utils';
import { setErrorLocale } from '../error';

// ========== 测试实体 ==========

@Table()
class IntegrationUser {
  @PrimaryKey()
  id?: number;

  @Column()
  @NotNull()
  @Required()
  @Length(2, 50)
  name!: string;

  @Column()
  @Email()
  email?: string;

  @Column({ type: ColumnType.INTEGER })
  @Min(0)
  @Max(150)
  age?: number;

  @Column()
  status?: string;

  @CreatedAt()
  createdAt?: string;

  @UpdatedAt()
  updatedAt?: string;

  @SoftDelete()
  deletedAt?: string;

  orders?: IntegrationOrder[];
}

@Table()
class IntegrationOrder {
  @PrimaryKey()
  id?: number;

  @Column({ name: 'user_id', type: ColumnType.INTEGER })
  userId?: number;

  @Column({ type: ColumnType.REAL })
  amount?: number;

  @Column()
  status?: string;

  @CreatedAt()
  createdAt?: string;

  user?: IntegrationUser;
}

// 注册关联
const userHasManyOrders: RelationMetadata = {
  propertyKey: 'orders',
  type: RelationType.HasMany,
  target: IntegrationOrder,
  foreignKey: 'user_id',
  localKey: 'id'
};
metadataStorage.addRelationMetadata(IntegrationUser, userHasManyOrders);

const orderBelongsToUser: RelationMetadata = {
  propertyKey: 'user',
  type: RelationType.BelongsTo,
  target: IntegrationUser,
  foreignKey: 'userId',
  localKey: 'id'
};
metadataStorage.addRelationMetadata(IntegrationOrder, orderBelongsToUser);

// ========== 测试框架 ==========

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

interface TestSuite {
  name: string;
  results: TestResult[];
}

let currentSuite: TestSuite | null = null;
const suites: TestSuite[] = [];

function describe(name: string, fn: () => void) {
  currentSuite = { name, results: [] };
  console.log(`\n=== ${name} ===`);
  fn();
  suites.push(currentSuite);
  currentSuite = null;
}

function it(name: string, fn: () => void) {
  const start = Date.now();
  const result: TestResult = { name, passed: true };
  try {
    fn();
    result.duration = Date.now() - start;
    console.log(`  ✓ ${name} (${result.duration}ms)`);
  } catch (e) {
    result.passed = false;
    result.error = (e as Error).message;
    result.duration = Date.now() - start;
    console.error(`  ✗ ${name}`);
    console.error(`    ${result.error}`);
  }
  currentSuite?.results.push(result);
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} < ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${Array.isArray(actual) ? actual.length : 'not array'}`);
      }
    },
    toContain(expected: unknown) {
      if (!Array.isArray(actual) || !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}`);
      }
    }
  };
}

// ========== 集成测试 ==========

let externalAdapter: DatabaseAdapter | null = null;

export function runIntegrationTests(adapter?: DatabaseAdapter): TestSuite[] {
  suites.length = 0;
  externalAdapter = adapter || null;
  let orm: ORM;

  describe('完整业务流程集成测试', () => {
    it('初始化 ORM 和迁移', () => {
      if (externalAdapter) {
        orm = initORM({ adapter: externalAdapter, logLevel: LogLevel.WARN });
      } else {
        orm = initORMWithMemory({ logLevel: LogLevel.WARN });
      }
      orm.migrate(IntegrationUser, IntegrationOrder);
      expect(orm).toBeTruthy();
    });

    it('创建用户并验证数据', () => {
      const user = new IntegrationUser();
      user.name = '张三';
      user.email = 'zhangsan@example.com';
      user.age = 25;
      user.status = 'active';

      // 验证数据
      const validation = validate(user);
      expect(validation.valid).toBe(true);

      // 插入
      const id = orm.insert(user);
      expect(id).toBeGreaterThan(0);
    });

    it('创建订单关联用户', () => {
      const order1 = new IntegrationOrder();
      order1.userId = 1;
      order1.amount = 100.50;
      order1.status = 'pending';
      orm.insert(order1);

      const order2 = new IntegrationOrder();
      order2.userId = 1;
      order2.amount = 200.00;
      order2.status = 'completed';
      orm.insert(order2);

      const orders = orm.query(IntegrationOrder).find();
      expect(orders).toHaveLength(2);
    });

    it('查询用户及其订单（预加载）', () => {
      const users = orm.query(IntegrationUser).with('orders').find();
      expect(users).toHaveLength(1);
      expect(users[0]?.orders).toHaveLength(2);
    });

    it('查询订单及其用户（反向关联）', () => {
      const orders = orm.query(IntegrationOrder).with('user').find();
      expect(orders).toHaveLength(2);
      expect(orders[0]?.user?.name).toBe('张三');
    });

    it('复杂条件查询', () => {
      // 添加更多用户
      const user2 = new IntegrationUser();
      user2.name = '李四';
      user2.age = 30;
      user2.status = 'active';
      orm.insert(user2);

      const user3 = new IntegrationUser();
      user3.name = '王五';
      user3.age = 20;
      user3.status = 'inactive';
      orm.insert(user3);

      // 复杂查询
      const activeUsers = orm.query(IntegrationUser)
        .where({ status: 'active' })
        .where({ age: { gte: 25 } })
        .orderBy('age', 'desc')
        .find();

      expect(activeUsers).toHaveLength(2);
      expect(activeUsers[0]?.name).toBe('李四');
    });

    it('事务中的批量操作', () => {
      const beforeCount = orm.query(IntegrationUser).count();

      orm.beginTransaction();
      try {
        for (let i = 0; i < 5; i++) {
          const user = new IntegrationUser();
          user.name = `事务用户${i}`;
          user.age = 20 + i;
          user.status = 'active';
          orm.insert(user);
        }
        orm.commit();
      } catch (e) {
        orm.rollback();
      }

      const afterCount = orm.query(IntegrationUser).count();
      expect(afterCount).toBe(beforeCount + 5);
    });

    it('软删除和恢复', () => {
      const beforeCount = orm.query(IntegrationUser).count();

      // 软删除
      orm.query(IntegrationUser).where({ name: '王五' }).softDelete();

      // 正常查询不包含已删除
      const normalCount = orm.query(IntegrationUser).count();
      expect(normalCount).toBe(beforeCount - 1);

      // withTrashed 包含已删除
      const allCount = orm.query(IntegrationUser).withTrashed().count();
      expect(allCount).toBe(beforeCount);

      // 恢复
      orm.query(IntegrationUser).withTrashed().where({ name: '王五' }).restore();
      const restoredCount = orm.query(IntegrationUser).count();
      expect(restoredCount).toBe(beforeCount);
    });

    it('数据验证失败场景', () => {
      const invalidUser = new IntegrationUser();
      invalidUser.name = 'A'; // 太短
      invalidUser.email = 'invalid-email'; // 无效邮箱
      invalidUser.age = 200; // 超出范围

      const result = validate(invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('更新操作', () => {
      const user = orm.query(IntegrationUser).where({ name: '张三' }).first();
      if (user) {
        user.age = 26;
        orm.save(user);

        const updated = orm.query(IntegrationUser).where({ name: '张三' }).first();
        expect(updated?.age).toBe(26);
      }
    });

    it('批量更新', () => {
      orm.query(IntegrationUser)
        .where({ status: 'active' })
        .update({ status: 'verified' });

      const verified = orm.query(IntegrationUser).where({ status: 'verified' }).count();
      expect(verified).toBeGreaterThan(0);
    });

    it('聚合查询', () => {
      const count = orm.query(IntegrationUser).count();
      expect(count).toBeGreaterThan(0);

      const exists = orm.query(IntegrationUser).where({ name: '张三' }).exists();
      expect(exists).toBe(true);

      const notExists = orm.query(IntegrationUser).where({ name: '不存在' }).exists();
      expect(notExists).toBe(false);
    });
  });

  describe('查询缓存集成测试', () => {
    it('缓存查询结果', () => {
      initQueryCache({ enabled: true, ttl: 60000, maxSize: 100 });
      const cache = getQueryCache();

      // 第一次查询并缓存
      const key = 'integration:users:active';
      const users = orm.query(IntegrationUser).where({ status: 'verified' }).find();
      cache.set(key, users);

      expect(users.length).toBeGreaterThan(0);

      // 第二次从缓存获取
      const cached = cache.get<IntegrationUser[]>(key);
      expect(cached?.length).toBe(users.length);
    });

    it('缓存失效', () => {
      const cache = getQueryCache();
      cache.set('test:key', [{ id: 1 }]);
      expect(cache.get('test:key')).toBeTruthy();

      cache.delete('test:key');
      expect(cache.get('test:key')).toBeFalsy();
    });
  });

  return suites;
}

// ========== 性能测试 ==========

export interface PerformanceResult {
  name: string;
  operations: number;
  totalTime: number;
  avgTime: number;
  opsPerSecond: number;
}

export function runPerformanceTests(adapter?: DatabaseAdapter): PerformanceResult[] {
  const results: PerformanceResult[] = [];
  let orm: ORM;

  console.log('\n=== 性能测试 ===\n');

  // 初始化
  if (adapter) {
    orm = initORM({ adapter, logLevel: LogLevel.ERROR });
  } else {
    orm = initORMWithMemory({ logLevel: LogLevel.ERROR });
  }

  @Table()
  class PerfUser {
    @PrimaryKey()
    id?: number;
    @Column()
    name!: string;
    @Column({ type: ColumnType.INTEGER })
    age?: number;
    @Column()
    email?: string;
  }

  orm.migrate(PerfUser);

  // 测试1: 单条插入性能
  const insertCount = 100;
  let start = Date.now();
  for (let i = 0; i < insertCount; i++) {
    const user = new PerfUser();
    user.name = `用户${i}`;
    user.age = 20 + (i % 50);
    user.email = `user${i}@test.com`;
    orm.insert(user);
  }
  let duration = Date.now() - start;
  results.push({
    name: '单条插入',
    operations: insertCount,
    totalTime: duration,
    avgTime: duration / insertCount,
    opsPerSecond: Math.round(insertCount / (duration / 1000))
  });
  console.log(`单条插入: ${insertCount} 条, ${duration}ms, ${results[0].opsPerSecond} ops/s`);

  // 测试2: 批量插入性能
  const batchSize = 100;
  const users: PerfUser[] = [];
  for (let i = 0; i < batchSize; i++) {
    const user = new PerfUser();
    user.name = `批量用户${i}`;
    user.age = 20 + (i % 50);
    user.email = `batch${i}@test.com`;
    users.push(user);
  }
  start = Date.now();
  orm.insert(users);
  duration = Date.now() - start;
  results.push({
    name: '批量插入',
    operations: batchSize,
    totalTime: duration,
    avgTime: duration / batchSize,
    opsPerSecond: Math.round(batchSize / (duration / 1000))
  });
  console.log(`批量插入: ${batchSize} 条, ${duration}ms, ${results[1].opsPerSecond} ops/s`);

  // 测试3: 简单查询性能
  const queryCount = 100;
  start = Date.now();
  for (let i = 0; i < queryCount; i++) {
    orm.query(PerfUser).find();
  }
  duration = Date.now() - start;
  results.push({
    name: '简单查询',
    operations: queryCount,
    totalTime: duration,
    avgTime: duration / queryCount,
    opsPerSecond: Math.round(queryCount / (duration / 1000))
  });
  console.log(`简单查询: ${queryCount} 次, ${duration}ms, ${results[2].opsPerSecond} ops/s`);

  // 测试4: 条件查询性能
  start = Date.now();
  for (let i = 0; i < queryCount; i++) {
    orm.query(PerfUser).where({ age: { gte: 30 } }).limit(10).find();
  }
  duration = Date.now() - start;
  results.push({
    name: '条件查询',
    operations: queryCount,
    totalTime: duration,
    avgTime: duration / queryCount,
    opsPerSecond: Math.round(queryCount / (duration / 1000))
  });
  console.log(`条件查询: ${queryCount} 次, ${duration}ms, ${results[3].opsPerSecond} ops/s`);

  // 测试5: 更新性能
  const updateCount = 50;
  start = Date.now();
  for (let i = 1; i <= updateCount; i++) {
    orm.query(PerfUser).where({ id: i }).update({ age: 99 });
  }
  duration = Date.now() - start;
  results.push({
    name: '条件更新',
    operations: updateCount,
    totalTime: duration,
    avgTime: duration / updateCount,
    opsPerSecond: Math.round(updateCount / (duration / 1000))
  });
  console.log(`条件更新: ${updateCount} 次, ${duration}ms, ${results[4].opsPerSecond} ops/s`);

  // 测试6: 事务性能
  const txCount = 10;
  start = Date.now();
  for (let i = 0; i < txCount; i++) {
    orm.beginTransaction();
    try {
      const user = new PerfUser();
      user.name = `事务用户${i}`;
      user.age = 25;
      orm.insert(user);
      orm.commit();
    } catch (e) {
      orm.rollback();
    }
  }
  duration = Date.now() - start;
  results.push({
    name: '事务操作',
    operations: txCount,
    totalTime: duration,
    avgTime: duration / txCount,
    opsPerSecond: Math.round(txCount / (duration / 1000))
  });
  console.log(`事务操作: ${txCount} 次, ${duration}ms, ${results[5].opsPerSecond} ops/s`);

  console.log('\n=== 性能测试完成 ===\n');

  return results;
}

// ========== 导出汇总 ==========

export interface IntegrationTestStats {
  totalTests: number;
  passed: number;
  failed: number;
  suites: TestSuite[];
  performance: PerformanceResult[];
}

export function runAllIntegrationTests(adapter?: DatabaseAdapter): IntegrationTestStats {
  const integrationSuites = runIntegrationTests(adapter);
  const perfResults = runPerformanceTests(adapter);

  let total = 0;
  let passed = 0;
  for (const suite of integrationSuites) {
    for (const result of suite.results) {
      total++;
      if (result.passed) passed++;
    }
  }

  return {
    totalTests: total,
    passed,
    failed: total - passed,
    suites: integrationSuites,
    performance: perfResults
  };
}
