/**
 * ORM 核心功能测试
 */

import { ORM, initORMWithMemory, getORM } from '../core';
import { Table, Column, PrimaryKey, CreatedAt, UpdatedAt, SoftDelete, NotNull } from '../decorator';
import { ColumnType, LogLevel } from '../types';
import { metadataStorage } from '../types/metadata';
import { MemoryAdapter } from '../adapter';
import { validate, Required, Length, Range } from '../validator';
import { QueryCache } from '../cache';
import { formatDate, setTimeFormat, getTimeFormat } from '../utils';
import { setErrorLocale, getErrorLocale, ErrorCode, ORMError } from '../error';

// 测试实体
@Table()
class User {
  @PrimaryKey()
  id?: number;

  @Column()
  name!: string;

  @Column({ type: ColumnType.INTEGER })
  age?: number;

  @CreatedAt()
  createdAt?: string;

  @UpdatedAt()
  updatedAt?: string;
}

@Table({ name: 'custom_posts' })
class Post {
  @PrimaryKey()
  id?: number;

  @Column()
  title!: string;

  @Column({ name: 'user_id', type: ColumnType.INTEGER })
  userId?: number;
}

// 测试 id 自动识别为主键
@Table()
class Article {
  @Column()
  id?: number;

  @Column()
  title!: string;
}

// 测试软删除
@Table()
class Comment {
  @PrimaryKey()
  id?: number;

  @Column()
  content!: string;

  @SoftDelete()
  deletedAt?: string;
}

// 测试关联查询 - 先声明类再添加关联
@Table()
class Author {
  @PrimaryKey()
  id?: number;

  @Column()
  name!: string;

  books?: Book[];
}

@Table()
class Book {
  @PrimaryKey()
  id?: number;

  @Column()
  title!: string;

  @Column({ name: 'author_id', type: ColumnType.INTEGER })
  authorId?: number;

  author?: Author;
}

// 手动注册关联元数据（避免循环引用问题）
import { metadataStorage as ms, RelationMetadata } from '../types/metadata';
import { RelationType } from '../types';

const authorHasManyBooks: RelationMetadata = {
  propertyKey: 'books',
  type: RelationType.HasMany,
  target: Book,
  foreignKey: 'author_id',
  localKey: 'id'
};
ms.addRelationMetadata(Author, authorHasManyBooks);

const bookBelongsToAuthor: RelationMetadata = {
  propertyKey: 'author',
  type: RelationType.BelongsTo,
  target: Author,
  foreignKey: 'authorId',
  localKey: 'id'
};
ms.addRelationMetadata(Book, bookBelongsToAuthor);

// 测试迁移日志的实体
@Table()
class TestMigration {
  @PrimaryKey()
  id?: number;
  @Column()
  name!: string;
}

// 测试验证的实体
@Table()
class ValidatedUser {
  @PrimaryKey()
  id?: number;

  @Required('用户名不能为空')
  @Column()
  username!: string;
}

@Table()
class LengthUser {
  @PrimaryKey()
  id?: number;

  @Length(3, 10)
  @Column()
  name!: string;
}

@Table()
class RangeUser {
  @PrimaryKey()
  id?: number;

  @Range(0, 150)
  @Column({ type: ColumnType.INTEGER })
  age!: number;
}

// 测试 @NotNull 装饰器
@Table()
class NotNullUser {
  @PrimaryKey()
  id?: number;

  @NotNull()
  @Column()
  name!: string;

  @Column()
  nickname?: string;
}

// 测试复合主键
@Table()
class OrderItem {
  @PrimaryKey({ autoIncrement: false })
  @Column({ type: ColumnType.INTEGER })
  orderId!: number;

  @PrimaryKey({ autoIncrement: false })
  @Column({ type: ColumnType.INTEGER })
  productId!: number;

  @Column({ type: ColumnType.INTEGER })
  quantity!: number;
}

// 测试框架
function describe(name: string, fn: () => void) {
  console.log(`\n=== ${name} ===`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, but got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(`Expected length ${expected}, but got ${Array.isArray(actual) ? actual.length : 'not an array'}`);
      }
    }
  };
}

// 运行测试
export function runORMTests() {
  let orm: ORM;

  describe('元数据收集', () => {
    it('应该收集 @Table 元数据', () => {
      const userMeta = metadataStorage.getEntityMetadata(User);
      expect(userMeta?.table.name).toBe('user');
      expect(userMeta?.table.className).toBe('User');
    });

    it('应该支持自定义表名', () => {
      const postMeta = metadataStorage.getEntityMetadata(Post);
      expect(postMeta?.table.name).toBe('custom_posts');
    });

    it('应该收集 @Column 元数据', () => {
      const userMeta = metadataStorage.getEntityMetadata(User);
      const nameCol = userMeta?.columns.find(c => c.propertyKey === 'name');
      expect(nameCol?.name).toBe('name');
      expect(nameCol?.type).toBe(ColumnType.TEXT);
    });

    it('应该收集 @PrimaryKey 元数据', () => {
      const userMeta = metadataStorage.getEntityMetadata(User);
      expect(userMeta?.primaryKey?.propertyKey).toBe('id');
      expect(userMeta?.primaryKey?.isPrimaryKey).toBe(true);
      expect(userMeta?.primaryKey?.isAutoIncrement).toBe(true);
    });

    it('应该收集时间戳元数据', () => {
      const userMeta = metadataStorage.getEntityMetadata(User);
      const createdAt = userMeta?.columns.find(c => c.propertyKey === 'createdAt');
      const updatedAt = userMeta?.columns.find(c => c.propertyKey === 'updatedAt');

      expect(createdAt?.isAutoCreateTime).toBe(true);
      expect(updatedAt?.isAutoUpdateTime).toBe(true);
    });
  });

  describe('ORM 初始化', () => {
    it('应该使用内存适配器初始化', () => {
      orm = initORMWithMemory({ debug: true, logLevel: LogLevel.DEBUG });
      expect(orm).toBeTruthy();
    });

    it('应该能获取全局实例', () => {
      const instance = getORM();
      expect(instance).toBe(orm);
    });
  });

  describe('数据库迁移', () => {
    it('应该创建表', () => {
      orm.migrate(User, Post);
      // 验证表已创建
      const adapter = orm.getAdapter() as MemoryAdapter;
      expect(adapter.getTableData('user')).toHaveLength(0);
    });
  });

  describe('CRUD 操作', () => {
    it('应该插入数据', () => {
      const user = new User();
      user.name = '张三';
      user.age = 25;

      const id = orm.insert(user);
      expect(id).toBeGreaterThan(0);
      expect(user.id).toBe(id);
    });

    it('应该查询数据', () => {
      const users = orm.query(User).find();
      expect(users).toHaveLength(1);
    });

    it('应该按条件查询', () => {
      const user = orm.query(User).where('name', '张三').first();
      expect(user?.name).toBe('张三');
    });

    it('应该使用对象条件查询', () => {
      const user = orm.query(User).where({ age: { gte: 20 } }).first();
      expect(user?.name).toBe('张三');
    });

    it('应该更新数据', () => {
      const user = orm.query(User).first();
      if (user) {
        user.age = 30;
        const count = orm.save(user);
        expect(count).toBeGreaterThan(0);
      }
    });

    it('应该删除数据', () => {
      const count = orm.query(User).where('name', '张三').delete();
      expect(count).toBeGreaterThan(0);

      const users = orm.query(User).find();
      expect(users).toHaveLength(0);
    });
  });

  describe('批量操作', () => {
    it('应该批量插入', () => {
      const users = [
        Object.assign(new User(), { name: '用户1', age: 20 }),
        Object.assign(new User(), { name: '用户2', age: 25 }),
        Object.assign(new User(), { name: '用户3', age: 30 })
      ];

      const count = orm.insert(users);
      expect(count).toBe(3);
    });

    it('应该查询多条', () => {
      const users = orm.query(User).find();
      expect(users).toHaveLength(3);
    });

    it('应该支持排序', () => {
      const users = orm.query(User).orderBy('age', 'desc').find();
      expect(users[0]?.age).toBe(30);
    });

    it('应该支持分页', () => {
      const users = orm.query(User).limit(2).find();
      expect(users).toHaveLength(2);
    });
  });

  describe('事务', () => {
    it('应该支持手动事务', () => {
      orm.beginTransaction();
      try {
        const user = new User();
        user.name = '事务用户';
        orm.insert(user);
        orm.commit();
      } catch (e) {
        orm.rollback();
      }

      const user = orm.query(User).where('name', '事务用户').first();
      expect(user).toBeTruthy();
    });
  });

  describe('查询构建器', () => {
    it('应该支持 count', () => {
      const count = orm.query(User).count();
      expect(count).toBeGreaterThan(0);
    });

    it('应该支持 exists', () => {
      const exists = orm.query(User).where('name', '用户1').exists();
      expect(exists).toBe(true);
    });

    it('应该支持 whereIn', () => {
      const users = orm.query(User).whereIn('age', [20, 25]).find();
      expect(users).toHaveLength(2);
    });

    it('应该支持 whereBetween', () => {
      const users = orm.query(User).whereBetween('age', 20, 25).find();
      expect(users).toHaveLength(2);
    });
  });

  describe('id 字段自动识别为主键', () => {
    it('应该自动将 id 字段识别为主键', () => {
      const articleMeta = metadataStorage.getEntityMetadata(Article);
      expect(articleMeta?.primaryKey?.propertyKey).toBe('id');
      expect(articleMeta?.primaryKey?.isPrimaryKey).toBe(true);
      expect(articleMeta?.primaryKey?.isAutoIncrement).toBe(true);
    });

    it('应该能正常插入和查询 Article', () => {
      orm.migrate(Article);
      const article = new Article();
      article.title = '测试文章';
      const id = orm.insert(article);
      expect(id).toBeGreaterThan(0);

      const found = orm.query(Article).where('id', id).first();
      expect(found?.title).toBe('测试文章');
    });
  });

  describe('软删除', () => {
    it('应该收集 @SoftDelete 元数据', () => {
      const commentMeta = metadataStorage.getEntityMetadata(Comment);
      const softDeleteCol = commentMeta?.columns.find(c => c.isSoftDelete);
      expect(softDeleteCol?.propertyKey).toBe('deletedAt');
      expect(softDeleteCol?.name).toBe('deleted_at');
    });

    it('应该能软删除记录', () => {
      orm.migrate(Comment);

      // 插入测试数据
      const comment1 = new Comment();
      comment1.content = '评论1';
      orm.insert(comment1);

      const comment2 = new Comment();
      comment2.content = '评论2';
      orm.insert(comment2);

      // 软删除第一条
      const count = orm.query(Comment).where('content', '评论1').softDelete();
      expect(count).toBeGreaterThan(0);
    });

    it('应该自动过滤软删除的记录', () => {
      const comments = orm.query(Comment).find();
      expect(comments).toHaveLength(1);
      expect(comments[0]?.content).toBe('评论2');
    });

    it('应该能使用 withTrashed 查询所有记录', () => {
      const comments = orm.query(Comment).withTrashed().find();
      expect(comments).toHaveLength(2);
    });

    it('应该能使用 onlyTrashed 只查询已删除记录', () => {
      const comments = orm.query(Comment).onlyTrashed().find();
      expect(comments).toHaveLength(1);
      expect(comments[0]?.content).toBe('评论1');
    });

    it('应该能恢复软删除的记录', () => {
      const count = orm.query(Comment).withTrashed().where('content', '评论1').restore();
      expect(count).toBeGreaterThan(0);

      const comments = orm.query(Comment).find();
      expect(comments).toHaveLength(2);
    });
  });

  describe('关联查询', () => {
    it('应该收集关联元数据', () => {
      const authorMeta = metadataStorage.getEntityMetadata(Author);
      const booksRelation = authorMeta?.relations.find(r => r.propertyKey === 'books');
      expect(booksRelation?.type).toBe(RelationType.HasMany);
      expect(booksRelation?.foreignKey).toBe('author_id');
    });

    it('应该创建关联表', () => {
      orm.migrate(Author, Book);
      const adapter = orm.getAdapter() as MemoryAdapter;
      expect(adapter.getTableData('author')).toHaveLength(0);
      expect(adapter.getTableData('book')).toHaveLength(0);
    });

    it('应该插入关联数据', () => {
      // 插入作者
      const author1 = new Author();
      author1.name = '作者A';
      orm.insert(author1);

      const author2 = new Author();
      author2.name = '作者B';
      orm.insert(author2);

      // 插入书籍
      const book1 = new Book();
      book1.title = '书籍1';
      book1.authorId = 1;
      orm.insert(book1);

      const book2 = new Book();
      book2.title = '书籍2';
      book2.authorId = 1;
      orm.insert(book2);

      const book3 = new Book();
      book3.title = '书籍3';
      book3.authorId = 2;
      orm.insert(book3);
    });

    it('应该支持 HasMany 预加载', () => {
      const authors = orm.query(Author).with('books').find();
      expect(authors).toHaveLength(2);

      const author1 = authors.find(a => a.name === '作者A');
      expect(author1?.books).toHaveLength(2);

      const author2 = authors.find(a => a.name === '作者B');
      expect(author2?.books).toHaveLength(1);
    });

    it('应该支持 BelongsTo 预加载', () => {
      const books = orm.query(Book).with('author').find();
      expect(books).toHaveLength(3);

      const book1 = books.find(b => b.title === '书籍1');
      expect(book1?.author?.name).toBe('作者A');

      const book3 = books.find(b => b.title === '书籍3');
      expect(book3?.author?.name).toBe('作者B');
    });

    it('应该支持 first() 带关联', () => {
      const author = orm.query(Author).with('books').where('name', '作者A').first();
      expect(author?.books).toHaveLength(2);
    });
  });

  describe('嵌套事务', () => {
    it('应该支持嵌套事务', () => {
      const beforeCount = orm.query(User).count();

      orm.beginTransaction();
      const user1 = new User();
      user1.name = '嵌套事务用户1';
      orm.insert(user1);

      // 嵌套事务
      orm.beginTransaction();
      const user2 = new User();
      user2.name = '嵌套事务用户2';
      orm.insert(user2);
      orm.commit(); // 提交内层事务

      orm.commit(); // 提交外层事务

      const afterCount = orm.query(User).count();
      expect(afterCount).toBe(beforeCount + 2);
    });

    it('应该支持外层事务回滚', () => {
      const beforeCount = orm.query(User).count();

      orm.beginTransaction();
      const user1 = new User();
      user1.name = '嵌套回滚用户1';
      orm.insert(user1);

      // 嵌套事务
      orm.beginTransaction();
      const user2 = new User();
      user2.name = '嵌套回滚用户2';
      orm.insert(user2);
      orm.commit(); // 提交内层事务（仅减少深度）

      orm.rollback(); // 回滚外层事务（实际回滚所有）

      // 外层事务回滚，所有数据都不保留
      const afterCount = orm.query(User).count();
      expect(afterCount).toBe(beforeCount);
    });

    it('应该正确跟踪事务深度', () => {
      expect(orm.getTransactionDepth()).toBe(0);
      orm.beginTransaction();
      expect(orm.getTransactionDepth()).toBe(1);
      orm.beginTransaction();
      expect(orm.getTransactionDepth()).toBe(2);
      orm.rollback();
      expect(orm.getTransactionDepth()).toBe(1);
      orm.rollback();
      expect(orm.getTransactionDepth()).toBe(0);
    });
  });

  describe('迁移日志', () => {
    it('应该记录迁移日志', () => {
      orm.clearMigrationLogs();
      orm.migrate(TestMigration);
      const logs = orm.getMigrationLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]?.action).toBe('create_table');
    });
  });

  describe('数据验证', () => {
    it('应该验证必填字段', () => {
      const user = new ValidatedUser();
      const result = validate(user);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该验证长度', () => {
      const user = new LengthUser();
      user.name = 'ab'; // 太短
      const result = validate(user);
      expect(result.valid).toBe(false);
    });

    it('应该验证数值范围', () => {
      const user = new RangeUser();
      user.age = 200; // 超出范围
      const result = validate(user);
      expect(result.valid).toBe(false);
    });
  });

  describe('查询缓存', () => {
    it('应该缓存查询结果', () => {
      const cache = new QueryCache({ enabled: true, ttl: 5000 });
      cache.set('test_key', [{ id: 1, name: 'test' }]);
      const result = cache.get<object[]>('test_key');
      expect(result).toHaveLength(1);
    });

    it('应该支持缓存过期', () => {
      const cache = new QueryCache({ enabled: true, ttl: 1 }); // 1ms 过期
      cache.set('expire_key', [{ id: 1 }]);
      // 等待过期
      const start = Date.now();
      while (Date.now() - start < 10) {} // 简单等待
      const result = cache.get('expire_key');
      expect(result).toBe(undefined);
    });

    it('应该支持按表名失效缓存', () => {
      const cache = new QueryCache({ enabled: true });
      cache.set('user:query1', [{ id: 1 }]);
      cache.set('user:query2', [{ id: 2 }]);
      cache.set('post:query1', [{ id: 3 }]);

      cache.invalidateByTable('user');

      expect(cache.get('user:query1')).toBe(undefined);
      expect(cache.get('user:query2')).toBe(undefined);
      expect(cache.get<object[]>('post:query1')).toHaveLength(1);
    });
  });

  describe('可配置时间格式', () => {
    it('应该支持不同时间格式', () => {
      const date = new Date('2024-01-15T10:30:45.000Z');
      expect(formatDate(date, 'date')).toBe('2024-01-15');
      expect(formatDate(date, 'timestamp')).toBe(String(date.getTime()));
      expect(formatDate(date, 'iso')).toBe(date.toISOString());
    });

    it('应该支持设置全局时间格式', () => {
      setTimeFormat('iso');
      expect(getTimeFormat().format).toBe('iso');
      // 恢复默认
      setTimeFormat('datetime');
    });
  });

  describe('延迟加载', () => {
    it('应该支持延迟加载查询', () => {
      // 延迟加载在访问属性时才加载数据
      const authors = orm.query(Author).lazy().find();
      expect(authors).toHaveLength(2);
      // 延迟加载的属性会在访问时自动加载
    });
  });

  describe('@NotNull 装饰器', () => {
    it('应该收集 @NotNull 元数据', () => {
      const meta = metadataStorage.getEntityMetadata(NotNullUser);
      const nameCol = meta?.columns.find(c => c.propertyKey === 'name');
      const nicknameCol = meta?.columns.find(c => c.propertyKey === 'nickname');
      expect(nameCol?.isNotNull).toBe(true);
      expect(nicknameCol?.isNotNull).toBe(false);
    });

    it('应该生成带 NOT NULL 的建表语句', () => {
      orm.migrate(NotNullUser);
      const adapter = orm.getAdapter() as MemoryAdapter;
      expect(adapter.getTableData('not_null_user')).toHaveLength(0);
    });
  });

  describe('复合主键', () => {
    it('应该收集复合主键元数据', () => {
      const meta = metadataStorage.getEntityMetadata(OrderItem);
      expect(meta?.primaryKeys.length).toBe(2);
      expect(meta?.primaryKeys[0]?.propertyKey).toBe('orderId');
      expect(meta?.primaryKeys[1]?.propertyKey).toBe('productId');
    });

    it('应该创建复合主键表', () => {
      orm.migrate(OrderItem);
      const adapter = orm.getAdapter() as MemoryAdapter;
      expect(adapter.getTableData('order_item')).toHaveLength(0);
    });
  });

  describe('错误信息国际化', () => {
    it('应该支持设置语言', () => {
      setErrorLocale('en');
      expect(getErrorLocale()).toBe('en');
      setErrorLocale('zh');
      expect(getErrorLocale()).toBe('zh');
    });

    it('应该根据语言返回错误信息', () => {
      setErrorLocale('zh');
      const zhError = new ORMError({ code: ErrorCode.DATABASE_NOT_FOUND });
      expect(zhError.message).toBe('数据库连接未建立');

      setErrorLocale('en');
      const enError = new ORMError({ code: ErrorCode.DATABASE_NOT_FOUND });
      expect(enError.message).toBe('Database connection not established');

      // 恢复默认
      setErrorLocale('zh');
    });
  });

  describe('回滚 SQL 生成', () => {
    it('应该生成 create_table 的回滚 SQL', () => {
      const log = { tableName: 'test', action: 'create_table' as const, sql: 'CREATE TABLE test' };
      const rollback = orm.generateRollbackSQL(log as any);
      expect(rollback).toBe('DROP TABLE IF EXISTS test;');
    });
  });

  console.log('\n=== 测试完成 ===\n');
}
