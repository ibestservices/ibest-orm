import {
  Table, Field, FieldType,
  HasOne, HasMany, BelongsTo, ManyToMany,
  CascadeType, GetIBestORM, IBestORM
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

export class Examples {
  private orm: IBestORM = GetIBestORM();

  /**
   * 初始化示例数据
   */
  async initializeData(): Promise<void> {
    console.log('=== 初始化示例数据 ===');

    // 自动迁移表结构
    this.orm.AutoMigrate(User);
    this.orm.AutoMigrate(Order);
    this.orm.AutoMigrate(OrderItem);
    this.orm.AutoMigrate(UserProfile);
    this.orm.AutoMigrate(Role);

    const hasUserRolesTable = this.orm.Migrator().HasTable('user_roles');
    console.log(`判断是否已创建关联关系表：user_roles 表是否存在: ${hasUserRolesTable}`);
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
      const result: number = await this.orm.Create(user, {cascade: true, entityClass: User});
      if(!result) {
        console.error('级联创建用户失败！');
      }
      console.log('用户ID:', user.id);
      console.log('用户资料ID:', user.profile?.id);
      console.log('订单数量:', user.orders?.length);

      // 测试关联查询
      const completeUserData = await this.orm.Session(User)
        .With(['profile', 'orders.items', 'roles'])
        .Where('email', 'john@example.com')
        .FirstWithRelations();
      console.log('关联查询结果:', JSON.stringify(completeUserData, null, 2));

      // 测试延迟查询
      const userFirst = new User();
      this.orm.Session(User).Where('email', 'john@example.com').First(userFirst);
      const lazyUser = this.orm.EnableLazyLoading(userFirst);
      const profile = this.orm.LoadRelation(lazyUser, 'profile');
      const roles = this.orm.LoadRelation(lazyUser, 'roles');
      console.log('延迟查询结果:');
      console.log('loadProfile:', JSON.stringify(profile, null, 2));
      console.log('loadRoles:', JSON.stringify(roles, null, 2));
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

    // 修改订单数据
    if (existingUser.orders?.length) {
      existingUser.orders[0].product_name = 'Gaming Laptop';
      existingUser.orders[0].amount = 1599.99;
    }

    try {
      console.log('开始级联更新用户...');
      await this.orm.Save(existingUser, {cascade: true, entityClass: User})

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
   * 示例3：级联删除操作
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
      await this.orm.DeleteByEntity(order, {cascade: true, entityClass: Order});

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
    console.log('开始运行操作示例...\n');
    try {
      await this.initializeData();
      await this.cascadeCreateExample();
      await this.cascadeUpdateExample();
      await this.cascadeDeleteExample();

      console.log('\n所有操作示例完成！');
      this.cleanupData();
    } catch (error) {
      console.error('示例运行失败:', error);
    }
  }

  /**
   * 清理示例数据
   */
  cleanupData(): void {
    console.log('=== 清理示例数据 ===');

    try {
      this.orm.Session(User).Delete();
      this.orm.Session(Order).Delete();
      this.orm.Session(OrderItem).Delete();
      this.orm.Session(UserProfile).Delete();
      this.orm.Session(Role).Delete();

      console.log('数据清理完成');
    } catch (error) {
      console.error('数据清理失败:', error);
    }
  }
}