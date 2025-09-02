/**
 * CascadeManager级联操作管理器使用示例
 * 演示如何使用级联操作管理器实现关联数据的自动创建、更新、删除
 */
import { CascadeManager, CascadeOperation, CascadeConfig, CascadeResult } from '../src/main/ets/core/CascadeManager';
import { RelationManager } from '../src/main/ets/core/RelationManager';
import { IBestORM } from '../src/main/ets/core/SQLiteORM';
import {
  Table, Field, FieldType,
  HasOne, HasMany, BelongsTo, ManyToMany,
  CascadeType, GetIBestORM
} from '../Index';

// 定义测试实体
@Table({name: 'users'})
class User {
  @Field({ type: FieldType.INTEGER, tag: ['primaryKey', 'autoIncrement', 'notNull'] })
  id?: number;

  @Field({ type: FieldType.TEXT })
  name?: string;

  @Field({ type: FieldType.TEXT })
  email?: string;

  // 一对多关联：用户有多个订单（级联创建和更新）
  @HasMany({
    target: () => Order,
    foreignKey: 'user_id',
    localKey: 'id',
    cascade: [CascadeType.Create, CascadeType.Update]
  })
  orders?: Order[];

  // 一对一关联：用户有一个用户资料（级联所有操作）
  @HasOne({
    target: () => UserProfile,
    foreignKey: 'user_id',
    localKey: 'id',
    cascade: [CascadeType.All]
  })
  profile?: UserProfile;

  // 多对多关联：用户有多个角色（级联创建和更新）
  @ManyToMany({
    target: () => Role,
    through: 'user_roles',
    throughForeignKey: 'user_id',
    throughOtherKey: 'role_id',
    cascade: [CascadeType.Create, CascadeType.Update]
  })
  roles?: Role[];
}

@Table({name: 'orders'})
class Order {
  @Field({ type: FieldType.INTEGER, tag: ['primaryKey', 'autoIncrement', 'notNull'] })
  id?: number;

  @Field({ type: FieldType.INTEGER })
  user_id?: number;

  @Field({ type: FieldType.TEXT })
  product_name?: string;

  @Field({ type: FieldType.REAL })
  amount?: number;

  // 多对一关联：订单属于一个用户
  @BelongsTo({
    target: () => User,
    foreignKey: 'user_id'
  })
  user?: User;

  // 一对多关联：订单有多个订单项（级联所有操作）
  @HasMany({
    target: () => OrderItem,
    foreignKey: 'order_id',
    cascade: [CascadeType.All]
  })
  items?: OrderItem[];
}

@Table({name: 'order_items'})
class OrderItem {
  @Field({ type: FieldType.INTEGER, tag: ['primaryKey', 'autoIncrement', 'notNull'] })
  id?: number;

  @Field({ type: FieldType.INTEGER })
  order_id?: number;

  @Field({ type: FieldType.TEXT })
  product_name?: string;

  @Field({ type: FieldType.INTEGER })
  quantity?: number;

  @Field({ type: FieldType.REAL })
  price?: number;

  // 多对一关联：订单项属于一个订单
  @BelongsTo({
    target: () => Order,
    foreignKey: 'order_id'
  })
  order?: Order;
}

@Table({name: 'user_profiles'})
class UserProfile {
  @Field({ type: FieldType.INTEGER, tag: ['primaryKey', 'autoIncrement', 'notNull'] })
  id?: number;

  @Field({ type: FieldType.INTEGER })
  user_id?: number;

  @Field({ type: FieldType.TEXT })
  bio?: string;

  @Field({ type: FieldType.TEXT })
  avatar?: string;

  @Field({ type: FieldType.TEXT })
  phone?: string;

  // 多对一关联：用户资料属于一个用户
  @BelongsTo({
    target: () => User,
    foreignKey: 'user_id'
  })
  user?: User;
}

@Table({name: 'roles'})
class Role {
  @Field({ type: FieldType.INTEGER, tag: ['primaryKey', 'autoIncrement', 'notNull'] })
  id?: number;

  @Field({ type: FieldType.TEXT })
  name?: string;

  @Field({ type: FieldType.TEXT })
  description?: string;

  // 多对多关联：角色有多个用户
  @ManyToMany({
    target: () => User,
    through: 'user_roles',
    throughForeignKey: 'role_id',
    throughOtherKey: 'user_id'
  })
  users?: User[];
}

/**
 * CascadeManager基础使用示例
 */
export class CascadeManagerBasicExample {
  private orm: IBestORM = GetIBestORM();
  private cascadeManager: CascadeManager = CascadeManager.getInstance(this.orm);

  /**
   * 初始化示例数据
   */
  async initializeData(): Promise<void> {
    console.log('=== 初始化级联操作示例数据 ===');
    this.cascadeManager = CascadeManager.getInstance(this.orm);

    // 自动迁移表结构
    this.orm.AutoMigrate(User);
    this.orm.AutoMigrate(Order);
    this.orm.AutoMigrate(OrderItem);
    this.orm.AutoMigrate(UserProfile);
    this.orm.AutoMigrate(Role);

    const hasUserRolesTable = this.orm.Migrator().HasTable('user_roles');
    console.log(`user_roles 表是否存在: ${hasUserRolesTable}`);
  }

  /**
   * 示例1：级联创建操作
   */
  async cascadeCreateExample() {
    console.log('=== 级联创建操作示例 ===');

    // 创建包含关联数据的用户
    const user: User = {
      name: 'John Doe',
      email: 'john@example.com',
      profile: {
        bio: 'Software Developer',
        avatar: 'avatar.jpg',
        phone: '123-456-7890'
      },
      orders: [
        {
          product_name: 'Laptop',
          amount: 1299.99,
          items: [
            { product_name: 'Laptop', quantity: 1, price: 1299.99 },
            { product_name: 'Mouse', quantity: 1, price: 29.99 }
          ]
        },
        {
          product_name: 'Phone',
          amount: 899.99,
          items: [
            { product_name: 'Phone', quantity: 1, price: 899.99 }
          ]
        }
      ],
      roles: [
        { name: 'user', description: 'Regular User' },
        { name: 'developer', description: 'Software Developer' }
      ]
    };

    try {
      console.log('开始级联创建用户...');
      const result: CascadeResult = await this.cascadeManager.cascadeCreate(user, User, {
        maxDepth: 3,
        transactionEnabled: false, // 如果开启事务，则无法通过主键作为关联id填充关联表。只能通过其他字段在准备插入数据时确定好。
        rollbackOnError: true
      });

      console.log('级联创建结果:');
      console.log('- 成功:', result.success);
      console.log('- 执行时间:', result.executionTime, 'ms');
      console.log('- 操作数量:', result.operationCount);
      console.log('- 受影响的实体:');

      const map = result.affectedEntities;
      const keys = map.keys();
      let key = keys.next();
      while (!key.done) {
        const tableName = key.value;
        const entities = map.get(tableName);
        if (entities) {
          console.log(`  ${tableName}: ${entities.length} 条记录`);
        }
        key = keys.next();
      }

      if (result.errors.length > 0) {
        console.log('- 错误信息:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.relation}: ${error.error.message}`);
        });
      }

      console.log('用户ID:', user.id);
      console.log('用户资料ID:', user.profile?.id);
      console.log('订单数量:', user.orders?.length);

      const ret_user = this.orm.Session(User).Find();
      console.log('UserData:', JSON.stringify(ret_user, null, 2));
      const ret_order = this.orm.Session(Order).Find();
      console.log('OrderData:', JSON.stringify(ret_order, null, 2));
      const ret_order_item = this.orm.Session(OrderItem).Find();
      console.log('OrderItemData:', JSON.stringify(ret_order_item, null, 2));
      const ret_user_profile = this.orm.Session(UserProfile).Find();
      console.log('UserProfileData:', JSON.stringify(ret_user_profile, null, 2));
      const ret_role = this.orm.Session(Role).Find();
      console.log('RoleData:', JSON.stringify(ret_role, null, 2));

      // 检查 user_roles 关联表数据
      const userRolesData = this.orm.Table('user_roles').Find();
      console.log('UserRolesData:', JSON.stringify(userRolesData, null, 2));

      // 先测试主查询
      const mainUser = this.orm.Session(User)
        .Where('email', 'john@example.com')
        .First();
      console.log('主查询结果:', JSON.stringify(mainUser, null, 2));

      // 再测试关联查询
      const completeUserData = await this.orm.Session(User)
        .With(['profile', 'orders.items', 'roles'])
        .Where('email', 'john@example.com')
        .FirstWithRelations();
      console.log('整体数据:', JSON.stringify(completeUserData, null, 2));

    } catch (error) {
      console.error('级联创建失败:', error);
    }
  }

  /**
   * 示例2：级联更新操作
   */
  async cascadeUpdateExample() {
    console.log('\n=== 级联更新操作示例 ===');

    // 获取现有用户（包含关联数据）
    const existingUser = await this.orm.Session(User)
      .With(['profile', 'orders.items'])
      .Where('id', 1)
      .FirstWithRelations() as User;
      
    if (!existingUser || !existingUser.id) {
      console.log('用户不存在，跳过更新示例');
      return;
    }

    console.log('获取到的现有用户数据:', JSON.stringify(existingUser, null, 2));

    // 修改用户及其关联数据
    existingUser.name = 'John Smith'; // 更新用户名
    existingUser.profile = {
      id: 1,
      user_id: existingUser.id,
      bio: 'Senior Software Developer', // 更新简介
      avatar: 'new_avatar.jpg',
      phone: '123-456-7890'
    };

    // 添加新订单
    if (!existingUser.orders) {
      existingUser.orders = [];
    }
    existingUser.orders.push({
      product_name: 'Tablet',
      amount: 599.99,
      items: [
        { product_name: 'Tablet', quantity: 1, price: 599.99 }
      ]
    });

    console.log('准备更新的用户数据:', JSON.stringify(existingUser, null, 2));

    try {
      console.log('开始级联更新用户...');
      const result: CascadeResult = await this.cascadeManager.cascadeUpdate(existingUser, User, {
        maxDepth: 2,
        transactionEnabled: true
      });

      console.log('级联更新结果:');
      console.log('- 成功:', result.success);
      console.log('- 执行时间:', result.executionTime, 'ms');
      console.log('- 操作数量:', result.operationCount);

      const map = result.affectedEntities;
      const keys = map.keys();
      let key = keys.next();
      while (!key.done) {
        const tableName = key.value;
        const entities = map.get(tableName);
        if (entities) {
          console.log(`  ${tableName}: ${entities.length} 条记录`);
        }
        key = keys.next();
      }

      const completeUserData = await this.orm.Session(User)
        .With(['profile', 'orders.items', 'roles'])
        .Where('email', 'john@example.com')
        .FirstWithRelations();
      console.log('更新后数据:', JSON.stringify(completeUserData, null, 2));
    } catch (error) {
      console.error('级联更新失败:', error);
    }
  }

  /**
   * 示例3：级联保存操作（智能创建或更新）
   */
  async cascadeSaveExample() {
    console.log('\n=== 级联保存操作示例 ===');

    const user: User = {
      id: 1, // 已存在的用户ID
      name: 'Updated John',
      email: 'updated.john@example.com',
      profile: {
        // 不指定ID，将创建新的用户资料
        bio: 'Updated Bio',
        avatar: 'updated_avatar.jpg',
        phone: '987-654-3210'
      },
      orders: [
        {
          id: 2, // 已存在的订单ID，将更新
          product_name: 'Updated Laptop',
          amount: 1399.99
        },
        {
          // 新订单，将创建
          product_name: 'New Product',
          amount: 299.99
        }
      ]
    };

    try {
      console.log('开始级联保存用户...');
      const result: CascadeResult = await this.cascadeManager.cascadeSave(user, User, {
        maxDepth: 2,
        transactionEnabled: true,
        batchSize: 50
      });

      console.log('级联保存结果:');
      console.log('- 成功:', result.success);
      console.log('- 执行时间:', result.executionTime, 'ms');
      console.log('- 操作数量:', result.operationCount);

    } catch (error) {
      console.error('级联保存失败:', error);
    }
  }

  /**
   * 示例4：级联删除操作
   */
  async cascadeDeleteExample() {
    console.log('\n=== 级联删除操作示例 ===');

    // 获取要删除的订单
    const order = new Order()
    this.orm.Table('orders').Where('id', 1).First(order);
    if (!order) {
      console.log('订单不存在，跳过删除示例');
      return;
    }

    try {
      console.log('开始级联删除订单...');
      const result: CascadeResult = await this.cascadeManager.cascadeDelete(order, Order, {
        maxDepth: 2,
        transactionEnabled: true,
        rollbackOnError: true
      });

      console.log('级联删除结果:');
      console.log('- 成功:', result.success);
      console.log('- 执行时间:', result.executionTime, 'ms');
      console.log('- 操作数量:', result.operationCount);

      const map = result.affectedEntities;
      const keys = map.keys();
      let key = keys.next();
      while (!key.done) {
        const tableName = key.value;
        const entities = map.get(tableName);
        if (entities) {
          console.log(`  ${tableName}: ${entities.length} 条记录`);
        }
        key = keys.next();
      }

      const completeUserData = await this.orm.Session(User)
        .With('orders.items')
        .Where('id', 1)
        .FirstWithRelations();
      console.log('删除Order后数据:', JSON.stringify(completeUserData, null, 2));
    } catch (error) {
      console.error('级联删除失败:', error);
    }
  }

  /**
   * 运行所有示例
   */
  async runAllExamples() {
    console.log('开始运行级联操作示例...\n');
    try {
      await this.initializeData();
      await this.cascadeCreateExample();
      await this.cascadeUpdateExample();
      await this.cascadeSaveExample();
      await this.cascadeDeleteExample();

      console.log('\n所有级联操作示例完成！');
      this.cleanupData();
    } catch (error) {
      console.error('示例运行失败:', error);
      console.error('延迟加载示例运行过程中发生错误:', error);
    }
  }

  /**
   * 清理示例数据
   */
  cleanupData(): void {
    console.log('=== 清理级联操作示例数据 ===');

    try {
      this.orm.Session(User).Delete();
      this.orm.Session(Order).Delete();
      this.orm.Session(OrderItem).Delete();
      this.orm.Session(UserProfile).Delete();
      this.orm.Session(Role).Delete();

      console.log('延迟加载示例数据清理完成');
    } catch (error) {
      console.error('数据清理失败:', error);
    }
  }
}