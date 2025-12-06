/**
 * IBest-ORM Next 基础使用示例
 */

import {
  ORM,
  initORMWithMemory,
  getORM,
  Table,
  Column,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsTo,
  ColumnType,
  LogLevel
} from '../index';

// ========== 1. 模型定义 ==========

/**
 * 用户模型
 * - @Table() 自动推断表名为 'user'
 * - @PrimaryKey() 自动设置为自增主键
 * - @Column() 自动推断类型
 */
@Table()
class User {
  @PrimaryKey()
  id?: number;

  @Column()
  name!: string;  // ! 表示必填

  @Column({ type: ColumnType.INTEGER })
  age?: number;   // ? 表示可选

  @Column()
  email?: string;

  @CreatedAt()
  createdAt?: string;

  @UpdatedAt()
  updatedAt?: string;

  // 一对多关联
  @HasMany(() => Post, { foreignKey: 'user_id' })
  posts?: Post[];
}

/**
 * 文章模型
 * - 自定义表名
 */
@Table({ name: 'posts' })
class Post {
  @PrimaryKey()
  id?: number;

  @Column()
  title!: string;

  @Column()
  content?: string;

  @Column({ name: 'user_id', type: ColumnType.INTEGER })
  userId?: number;

  @CreatedAt()
  createdAt?: string;

  // 多对一关联
  @BelongsTo(() => User, { foreignKey: 'user_id' })
  author?: User;
}

// ========== 2. 初始化 ==========

async function initDatabase() {
  // 使用内存数据库（适用于测试和预览器）
  const orm = initORMWithMemory({
    debug: true,
    logLevel: LogLevel.DEBUG
  });

  // 自动迁移表结构
  orm.migrate(User, Post);

  return orm;
}

// ========== 3. CRUD 操作示例 ==========

async function crudExamples() {
  const db = getORM();

  // --- 创建 ---
  console.log('\n--- 创建数据 ---');

  const user = new User();
  user.name = '张三';
  user.age = 25;
  user.email = 'zhangsan@example.com';

  const userId = db.insert(user);
  console.log(`创建用户成功，ID: ${userId}`);

  // 批量创建
  const users = [
    Object.assign(new User(), { name: '李四', age: 30 }),
    Object.assign(new User(), { name: '王五', age: 28 })
  ];
  db.insert(users);
  console.log('批量创建用户成功');

  // --- 查询 ---
  console.log('\n--- 查询数据 ---');

  // 查询所有
  const allUsers = db.query(User).find();
  console.log(`共有 ${allUsers.length} 个用户`);

  // 条件查询
  const adultUsers = db.query(User)
    .where({ age: { gte: 25 } })
    .orderBy('age', 'desc')
    .find();
  console.log(`成年用户: ${adultUsers.map(u => u.name).join(', ')}`);

  // 查询单条
  const firstUser = db.query(User).where('name', '张三').first();
  console.log(`找到用户: ${firstUser?.name}`);

  // 复杂查询
  const filteredUsers = db.query(User)
    .where({ age: { gte: 25, lte: 30 } })
    .whereNotNull('email')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .find();
  console.log(`筛选结果: ${filteredUsers.length} 条`);

  // --- 更新 ---
  console.log('\n--- 更新数据 ---');

  if (firstUser) {
    firstUser.age = 26;
    db.save(firstUser);
    console.log('更新用户年龄成功');
  }

  // 条件更新
  const updateCount = db.query(User)
    .where('name', '李四')
    .update({ age: 31 });
  console.log(`更新了 ${updateCount} 条记录`);

  // --- 删除 ---
  console.log('\n--- 删除数据 ---');

  // 条件删除
  const deleteCount = db.query(User)
    .where('name', '王五')
    .delete();
  console.log(`删除了 ${deleteCount} 条记录`);

  // 根据 ID 删除
  // db.deleteById(User, 1);
}

// ========== 4. 事务示例 ==========

async function transactionExample() {
  const db = getORM();

  console.log('\n--- 事务操作 ---');

  // 方式1: 回调式事务（推荐）
  try {
    await db.transaction(async (tx) => {
      const user1 = new User();
      user1.name = '事务用户1';
      tx.insert(user1);

      const user2 = new User();
      user2.name = '事务用户2';
      tx.insert(user2);

      // 如果这里抛出异常，会自动回滚
    });
    console.log('事务提交成功');
  } catch (e) {
    console.log('事务回滚');
  }

  // 方式2: 手动事务
  db.beginTransaction();
  try {
    const user = new User();
    user.name = '手动事务用户';
    db.insert(user);
    db.commit();
    console.log('手动事务提交成功');
  } catch (e) {
    db.rollback();
    console.log('手动事务回滚');
  }
}

// ========== 5. 查询构建器高级用法 ==========

async function advancedQueryExamples() {
  const db = getORM();

  console.log('\n--- 高级查询 ---');

  // 统计
  const count = db.query(User).count();
  console.log(`用户总数: ${count}`);

  // 存在性检查
  const exists = db.query(User).where('name', '张三').exists();
  console.log(`张三是否存在: ${exists}`);

  // IN 查询
  const selectedUsers = db.query(User)
    .whereIn('name', ['张三', '李四'])
    .find();
  console.log(`IN 查询结果: ${selectedUsers.length} 条`);

  // BETWEEN 查询
  const ageRangeUsers = db.query(User)
    .whereBetween('age', 20, 30)
    .find();
  console.log(`年龄在 20-30 之间: ${ageRangeUsers.length} 人`);

  // LIKE 查询
  const likeUsers = db.query(User)
    .whereLike('name', '张%')
    .find();
  console.log(`姓张的用户: ${likeUsers.length} 人`);

  // OR 条件
  const orUsers = db.query(User)
    .where('age', 25)
    .or()
    .where('age', 30)
    .find();
  console.log(`年龄 25 或 30: ${orUsers.length} 人`);
}

// ========== 运行示例 ==========

export async function runExamples() {
  console.log('========================================');
  console.log('  IBest-ORM Next 使用示例');
  console.log('========================================');

  await initDatabase();
  await crudExamples();
  await transactionExample();
  await advancedQueryExamples();

  console.log('\n========================================');
  console.log('  示例运行完成');
  console.log('========================================');
}
