import {
  Table, Field, FieldType, Model,
  HasOne, HasMany, BelongsTo, ManyToMany,
  CascadeType, GetIBestORM
} from '../Index';
import { IBestORM } from '../src/main/ets/core/SQLiteORM';
import { LazyLoadProxy } from '../src/main/ets/core/LazyLoad';

// 定义示例实体类
@Table({ name: 'users' })
class User extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  name?: string;

  @Field({ type: FieldType.TEXT })
  email?: string;

  @HasOne({
    target: () => UserProfile,
    foreignKey: 'user_id',
    localKey: 'id'
  })
  profile?: UserProfile;

  @HasMany({
    target: () => Order,
    foreignKey: 'user_id',
    localKey: 'id'
  })
  orders?: Order[];

  constructor(name: string, email: string) {
    super();
    this.name = name;
    this.email = email;
  }
}

@Table({ name: 'user_profiles' })
class UserProfile extends Model {
  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  user_id?: number;

  @Field({ type: FieldType.TEXT })
  avatar?: string;

  @Field({ type: FieldType.TEXT })
  bio?: string;

  @BelongsTo({
    target: () => User,
    foreignKey: 'user_id',
    localKey: 'id'
  })
  user?: User;

  constructor(user_id: number, avatar: string, bio: string) {
    super();
    this.user_id = user_id;
    this.avatar = avatar;
    this.bio = bio;
  }
}

@Table({ name: 'orders' })
class Order extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  order_no?: string;

  @Field({ type: FieldType.REAL })
  amount?: number;

  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  user_id?: number;

  @BelongsTo({
    target: () => User,
    foreignKey: 'user_id',
    localKey: 'id'
  })
  user?: User;

  @HasMany({
    target: () => OrderItem,
    foreignKey: 'order_id',
    localKey: 'id'
  })
  items?: OrderItem[];

  constructor(order_no: string, amount: number, user_id: number) {
    super();
    this.order_no = order_no;
    this.amount = amount;
    this.user_id = user_id;
  }
}

@Table({ name: 'order_items' })
class OrderItem extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  product_name?: string;

  @Field({ type: FieldType.INTEGER })
  quantity?: number;

  @Field({ type: FieldType.REAL })
  price?: number;

  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  order_id?: number;

  @BelongsTo({
    target: () => Order,
    foreignKey: 'order_id',
    localKey: 'id'
  })
  order?: Order;

  constructor(product_name: string, quantity: number, price: number, order_id: number) {
    super();
    this.product_name = product_name;
    this.quantity = quantity;
    this.price = price;
    this.order_id = order_id;
  }
}

/**
 * 延迟加载使用示例
 */
export class LazyLoadExample {
  private orm: IBestORM = GetIBestORM();

  /**
   * 初始化示例数据
   */
  async initializeData(): Promise<void> {
    console.log('=== 初始化延迟加载示例数据 ===');

    // 自动迁移表结构
    this.orm.AutoMigrate(User);
    this.orm.AutoMigrate(UserProfile);
    this.orm.AutoMigrate(Order);
    this.orm.AutoMigrate(OrderItem);

    // 创建示例数据
    await this.createSampleData();
  }

  /**
   * 创建示例数据
   */
  private async createSampleData(): Promise<void> {
    // 创建用户
    const users = [
      new User('张三', 'zhangsan@example.com'),
      new User('李四', 'lisi@example.com')
    ];

    for (const user of users) {
      this.orm.Create(user);
    }
    const ret = this.orm.Session(User).Find();
    console.log("SampleData[User]:", JSON.stringify(ret))

    // 创建用户档案
    const profiles = [
      new UserProfile(1, 'avatar1.jpg', '热爱购物的用户'),
      new UserProfile(2, 'avatar2.jpg', '理性消费者')
    ];

    for (const profile of profiles) {
      this.orm.Create(profile);
    }
    const ret_profile = this.orm.Session(UserProfile).Find();
    console.log("SampleData[UserProfile]:", JSON.stringify(ret_profile))

    // 创建订单
    const orders = [
      new Order('ORD001', 299.99, 1),
      new Order('ORD002', 199.50, 1),
      new Order('ORD003', 89.99, 2)
    ];

    for (const order of orders) {
      this.orm.Create(order);
    }
    const ret_order = this.orm.Session(Order).Find();
    console.log("SampleData[Order]:", JSON.stringify(ret_order))

    // 创建订单项
    const orderItems = [
      new OrderItem('iPhone手机壳', 1, 29.99, 1),
      new OrderItem('无线充电器', 1, 89.99, 1),
      new OrderItem('蓝牙耳机', 1, 179.99, 1),
      new OrderItem('数据线', 2, 19.99, 2),
      new OrderItem('充电头', 1, 39.99, 2),
      new OrderItem('平板电脑', 1, 89.99, 3)
    ];

    for (const item of orderItems) {
      this.orm.Create(item);
    }
    const ret_items = this.orm.Session(OrderItem).Find();
    console.log("SampleData[OrderItem]:", JSON.stringify(ret_items))

    console.log('延迟加载示例数据创建完成');
  }

  /**
   * 示例1：基本延迟加载使用
   */
  async exampleBasicLazyLoading(): Promise<void> {
    console.log('\n=== 示例1：基本延迟加载使用 ===');

    try {
      const user = new User('', '');
      this.orm.Session(User).Where('id', 1).First(user);
      console.log('查询到的用户:', JSON.stringify(user, null, 2));

      // 启用延迟加载，返回代理对象
      const lazyUser = this.orm.EnableLazyLoading(user);
      console.log('延迟加载代理已创建');

      // 加载orders关联
      const orders = this.orm.LoadRelation(lazyUser, 'orders');
      console.log('用户的订单:', JSON.stringify(orders, null, 2));

      // 加载profile关联
      const profile = this.orm.LoadRelation(lazyUser, 'profile');
      console.log('用户的档案:', JSON.stringify(profile, null, 2));

    } catch (error) {
      console.error('基本延迟加载示例失败:', error);
    }
  }

  /**
   * 示例2：检查关联是否已加载
   */
  async exampleCheckLoadedRelations(): Promise<void> {
    console.log('\n=== 示例2：检查关联是否已加载 ===');

    try {
      const user = new User('', '');
      this.orm.Session(User).Where('id', 1).First(user);
      const lazyUser = this.orm.EnableLazyLoading(user);

      // 检查orders是否已加载（应该是false）
      console.log('orders是否已加载:', this.orm.IsRelationLoaded(lazyUser, 'orders'));

      // 加载orders
      this.orm.LoadRelation(lazyUser, 'orders');

      // 再次检查（应该是true）
      console.log('加载后orders是否已加载:', this.orm.IsRelationLoaded(lazyUser, 'orders'));

      // 获取已加载的关联数据（同步）
      const loadedOrders = this.orm.GetLoadedRelation(lazyUser, 'orders');
      console.log('已加载的订单数量:', loadedOrders?.length || 0);

    } catch (error) {
      console.error('检查加载状态示例失败:', error);
    }
  }

  /**
   * 示例3：预加载关联数据（统一API）
   */
  async examplePreloadRelations(): Promise<void> {
    console.log('\n=== 示例3：预加载关联数据 ===');

    try {
      const user = new User('', '');
      this.orm.Session(User).Where('id', 1).First(user);
      const lazyUser = this.orm.EnableLazyLoading(user);

      // 预加载单个关联
      console.log('开始预加载profile...');
      await this.orm.PreloadRelation(lazyUser, 'profile');
      console.log('profile预加载完成');

      // 批量预加载多个关联
      console.log('开始批量预加载...');
      await this.orm.PreloadRelation(lazyUser, ['orders']);
      console.log('批量预加载完成');

      // 现在获取数据应该很快，因为已经预加载了
      const profile = this.orm.GetLoadedRelation(lazyUser, 'profile');
      const orders = this.orm.GetLoadedRelation(lazyUser, 'orders');
      
      console.log('预加载的profile:', JSON.stringify(profile));
      console.log('预加载的订单数量:', orders?.length || 0);

    } catch (error) {
      console.error('预加载示例失败:', error);
    }
  }

  /**
   * 示例4：重新加载关联数据（支持批量）
   */
  async exampleReloadRelations(): Promise<void> {
    console.log('\n=== 示例4：重新加载关联数据 ===');

    try {
      const user = new User('', '');
      this.orm.Session(User).Where('id', 1).First(user);
      const lazyUser = this.orm.EnableLazyLoading(user);

      // 首次加载
      const orders1 = this.orm.LoadRelation(lazyUser, 'orders');
      const profile1 = this.orm.LoadRelation(lazyUser, 'profile');
      console.log('首次加载的订单数量:', orders1?.length || 0);
      console.log('首次加载的profile:', JSON.stringify(profile1));

      // 单个重新加载
      const orders2 = this.orm.ReloadRelation(lazyUser, 'orders');
      console.log('重新加载的订单数量:', orders2?.length || 0);

      // 批量重新加载（使用同一个API）
      const reloadedData = this.orm.ReloadRelation(lazyUser, ['orders', 'profile']);
      console.log('批量重新加载完成，返回数据数量:', reloadedData?.length || 0);
      if (Array.isArray(reloadedData)) {
        console.log('批量重新加载的数据:', JSON.stringify(reloadedData));
      }

    } catch (error) {
      console.error('重新加载示例失败:', error);
    }
  }

  /**
   * 示例5：嵌套关联加载
   */
  async exampleNestedRelations(): Promise<void> {
    console.log('\n=== 示例5：嵌套关联加载 ===');

    try {
      // 先加载用户的订单
      const user = new User('', '');
      this.orm.Session(User).Where('id', 1).First(user);
      const lazyUser = this.orm.EnableLazyLoading(user);
      
      const orders = this.orm.LoadRelation(lazyUser, 'orders');
      console.log('用户订单数量:', orders?.length || 0);

      // 然后为每个订单加载其订单项
      if (Array.isArray(orders) && orders.length > 0) {
        for (let i = 0; i < orders.length; i++) {
          const order = orders[i];
          const lazyOrder = this.orm.EnableLazyLoading(order, Order);
          
          const items = this.orm.LoadRelation(lazyOrder, 'items');
          console.log(`订单 ${order.order_no} 的商品数量:`, items?.length || 0);
          
          if (Array.isArray(items) && items.length > 0) {
            console.log(`  第一个商品: ${items[0].product_name}`);
          }
        }
      }

    } catch (error) {
      console.error('嵌套关联加载示例失败:', error);
    }
  }

  /**
   * 示例6：反向关联加载
   */
  async exampleBelongsToRelations(): Promise<void> {
    console.log('\n=== 示例6：反向关联加载 ===');

    try {
      // 查询订单
      const order = new Order('', 0, 0);
      this.orm.Session(Order).Where('id', 1).First(order);
      console.log('查询到的订单:', order.order_no);

      const lazyOrder = this.orm.EnableLazyLoading(order, Order);

      // 加载订单的用户信息
      const user = this.orm.LoadRelation(lazyOrder, 'user');
      console.log('订单所属用户:', JSON.stringify(user));

      // 加载订单的商品项
      const items = this.orm.LoadRelation(lazyOrder, 'items');
      console.log('订单商品数量:', items?.length || 0);

    } catch (error) {
      console.error('反向关联加载示例失败:', error);
    }
  }

  /**
   * 示例7：缓存管理
   */
  async exampleCacheManagement(): Promise<void> {
    console.log('\n=== 示例7：缓存管理 ===');

    try {
      const user = new User('', '');
      this.orm.Session(User).Where('id', 1).First(user);
      const lazyUser = this.orm.EnableLazyLoading(user);

      // 加载数据到缓存
      this.orm.LoadRelation(lazyUser, 'orders');
      console.log('数据已加载到缓存');

      // 检查是否已加载
      console.log('orders是否在缓存中:', this.orm.IsRelationLoaded(lazyUser, 'orders'));

      // 清除缓存
      this.orm.ClearLazyLoadCache();
      console.log('缓存已清除');

      // 再次加载（这次会重新从数据库获取）
      const orders = this.orm.LoadRelation(lazyUser, 'orders');
      console.log('缓存清除后重新加载的订单数量:', orders?.length || 0);

    } catch (error) {
      console.error('缓存管理示例失败:', error);
    }
  }

  /**
   * 运行所有延迟加载示例
   */
  async runAllExamples(): Promise<void> {
    console.log('开始运行延迟加载示例...\n');

    try {
      await this.initializeData();
      await this.exampleBasicLazyLoading();
      await this.exampleCheckLoadedRelations();
      await this.examplePreloadRelations();
      await this.exampleReloadRelations();
      await this.exampleNestedRelations();
      await this.exampleBelongsToRelations();
      await this.exampleCacheManagement();

      console.log('\n所有延迟加载示例完成！');
      this.cleanupData();
    } catch (error) {
      console.error('延迟加载示例运行过程中发生错误:', error);
    }
  }

  /**
   * 清理示例数据
   */
  cleanupData(): void {
    console.log('=== 清理延迟加载示例数据 ===');

    try {
      this.orm.Session(OrderItem).Delete();
      this.orm.Session(Order).Delete();
      this.orm.Session(UserProfile).Delete();
      this.orm.Session(User).Delete();

      console.log('延迟加载示例数据清理完成');
    } catch (error) {
      console.error('数据清理失败:', error);
    }
  }
}