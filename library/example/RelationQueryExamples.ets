import {
  Table, Field, FieldType, Model,
  HasOne, HasMany, BelongsTo, ManyToMany,
  CascadeType, GetIBestORM
} from '../Index';
import { IBestORM } from '../src/main/ets/core/SQLiteORM';

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
    localKey: 'id',
    cascade: [CascadeType.Create, CascadeType.Update, CascadeType.Delete]
  })
  profile?: UserProfile;

  @HasMany({
    target: () => Article,
    foreignKey: 'author_id',
    localKey: 'id',
    cascade: [CascadeType.Delete]
  })
  articles?: Article[];

  @ManyToMany({
    target: () => Role,
    through: 'user_roles',
    throughForeignKey: 'user_id',
    throughOtherKey: 'role_id'
  })
  roles?: Role[];

  constructor(name: string, email: string) {
    super();
    this.name = name
    this.email = email
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

@Table({ name: 'articles' })
class Article extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  title?: string;

  @Field({ type: FieldType.TEXT })
  content?: string;

  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  author_id?: number;

  @Field({ type: FieldType.INTEGER })
  category_id?: number;

  @BelongsTo({
    target: () => User,
    foreignKey: 'author_id',
    localKey: 'id'
  })
  author?: User;

  @BelongsTo({
    target: () => Category,
    foreignKey: 'category_id',
    localKey: 'id'
  })
  category?: Category;

  @HasMany({
    target: () => Comment,
    foreignKey: 'article_id',
    localKey: 'id',
    cascade: [CascadeType.Delete]
  })
  comments?: Comment[];

  constructor(title: string, content: string, author_id: number, category_id: number) {
    super();
    this.title = title;
    this.content = content;
    this.author_id = author_id;
    this.category_id = category_id;
  }
}

@Table({ name: 'categories' })
class Category extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  name?: string;

  @Field({ type: FieldType.TEXT })
  description?: string;

  @HasMany({
    target: () => Article,
    foreignKey: 'category_id',
    localKey: 'id'
  })
  articles?: Article[];

  constructor(name: string, desc: string) {
    super();
    this.name = name;
    this.description = desc;
  }
}

@Table({ name: 'comments' })
class Comment extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  content?: string;

  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  article_id?: number;

  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  user_id?: number;

  @BelongsTo({
    target: () => Article,
    foreignKey: 'article_id',
    localKey: 'id'
  })
  article?: Article;

  @BelongsTo({
    target: () => User,
    foreignKey: 'user_id',
    localKey: 'id'
  })
  user?: User;

  constructor(content: string, article_id: number, user_id: number) {
    super();
    this.content = content;
    this.article_id = article_id;
    this.user_id = user_id;
  }
}

@Table({ name: 'roles' })
class Role extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  name?: string;

  @Field({ type: FieldType.TEXT })
  description?: string;

  @ManyToMany({
    target: () => User,
    through: 'user_roles',
    throughForeignKey: 'role_id',
    throughOtherKey: 'user_id'
  })
  users?: User[];

  constructor(name: string, description: string) {
    super();
    this.name = name;
    this.description = description;
  }
}

/**
 * 关联查询使用示例
 */
export class RelationQueryExample {
  private orm: IBestORM = GetIBestORM();

  /**
   * 初始化示例数据
   */
  async initializeData(): Promise<void> {
    console.log('=== 初始化示例数据 ===');

    // 自动迁移表结构
    this.orm.AutoMigrate(User);
    this.orm.AutoMigrate(UserProfile);
    this.orm.AutoMigrate(Article);
    this.orm.AutoMigrate(Category);
    this.orm.AutoMigrate(Comment);
    this.orm.AutoMigrate(Role);

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
      new User('李四', 'lisi@example.com'),
      new User('王五', 'wangwu@example.com')
    ];

    for (const user of users) {
      this.orm.Create(user);
    }
    const ret = this.orm.Session(User).Find();
    console.log("SampleData[User]:", JSON.stringify(ret))

    // 创建分类
    const categories = [
      new Category('技术', '技术相关文章'),
      new Category('生活', '生活感悟文章'),
      new Category('学习', '学习心得文章')
    ];

    for (const category of categories) {
      this.orm.Create(category);
    }

    // 创建用户档案
    const profiles = [
      new UserProfile(1, 'avatar1.jpg', '热爱技术的程序员'),
      new UserProfile(2, 'avatar2.jpg', '喜欢分享生活的博主'),
      new UserProfile(3, 'avatar3.jpg', '终身学习者')
    ];

    for (const profile of profiles) {
      this.orm.Create(profile);
    }
    const ret_profile = this.orm.Session(UserProfile).Find();
    console.log("SampleData[UserProfile]:", JSON.stringify(ret_profile))

    // 创建文章
    const articles = [
      new Article('TypeScript入门指南', 'TypeScript是JavaScript的超集...', 1, 1),
      new Article('React最佳实践', 'React开发中的一些最佳实践...', 1, 1),
      new Article('我的生活感悟', '生活中的点点滴滴...', 2, 2),
      new Article('学习方法分享', '如何高效学习新技术...', 3, 3),
      new Article('Node.js实战', 'Node.js后端开发实战...', 1, 1)
    ];

    for (const article of articles) {
      this.orm.Create(article);
    }
    const ret_article = this.orm.Session(Article).Find();
    console.log("SampleData[Article]:", JSON.stringify(ret_article))

    // 创建评论
    const comments = [
      new Comment('写得很好，学到了！', 1, 2),
      new Comment('感谢分享，很有帮助', 1, 3),
      new Comment('期待更多内容', 2, 2),
      new Comment('深有同感', 3, 1),
      new Comment('很实用的方法', 4, 1),
      new Comment('收藏了', 4, 2)
    ];

    for (const comment of comments) {
      this.orm.Create(comment);
    }
    const ret_comment = this.orm.Session(Comment).Find();
    console.log("SampleData[Comment]:", JSON.stringify(ret_comment))

    // 创建角色
    const roles = [
      new Role('admin', '管理员'),
      new Role('editor', '编辑'),
      new Role('user', '普通用户')
    ];

    for (const role of roles) {
      this.orm.Create(role);
    }
    const ret_role = this.orm.Session(Role).Find();
    console.log("SampleData[Role]:", JSON.stringify(ret_role))

    // 创建用户角色关联（多对多关系）   ！！！！未实现创建关联表。
    // 注意：这里需要直接插入中间表数据
    // 张三是管理员
    //await this.orm.GetCore()?.executeSql(`INSERT INTO user_roles (user_id, role_id) VALUES (1, 1)`);
    // 张三也是编辑
    //await this.orm.GetCore()?.executeSql(`INSERT INTO user_roles (user_id, role_id) VALUES (1, 2)`);
    // 李四是编辑
    //await this.orm.GetCore()?.executeSql(`INSERT INTO user_roles (user_id, role_id) VALUES (2, 2)`);
    // 王五是普通用户
    //await this.orm.GetCore()?.executeSql(`INSERT INTO user_roles (user_id, role_id) VALUES (3, 3)`);

    console.log('示例数据创建完成');
  }

  /**
   * 示例1：预加载单个关联
   */
  async examplePreloadSingleRelation(): Promise<void> {
    console.log('\n=== 示例1：预加载单个关联 ===');

    try {
      // 先验证数据是否存在
      const user = this.orm.Session(User).Where('id', 1).First();
      console.log('用户数据:', JSON.stringify(user, null, 2));
      
      const profile = this.orm.Session(UserProfile).Where('user_id', 1).First();
      console.log('档案数据:', JSON.stringify(profile, null, 2));

      // 测试关联查询的各个步骤
      console.log('开始关联查询调试...');
      
      // 创建查询会话
      const session = this.orm.Session(User).With('profile').Where('id', 1);
      console.log('查询会话创建完成');
      
      // 手动测试关联查询
      const userWithProfile = await session.FirstWithRelations();
      console.log('用户及档案信息:', JSON.stringify(userWithProfile, null, 2));
      
      // 额外测试：直接查询关联数据
      console.log('直接测试关联查询...');
      const profiles = this.orm.Session(UserProfile).Where('user_id', [1]).Find();
      console.log('通过数组查询档案:', JSON.stringify(profiles, null, 2));
      
    } catch (error) {
      console.error('查询失败:', error);
    }
  }

  /**
   * 示例2：预加载多个关联
   */
  async examplePreloadMultipleRelations(): Promise<void> {
    console.log('\n=== 示例2：预加载多个关联 ===');

    try {
      // 查询用户并预加载档案和文章
      const userWithRelations = await this.orm.Session(User).With(['profile', 'articles']).Where('id', 1).FirstWithRelations();
      console.log('用户、档案及文章信息:', JSON.stringify(userWithRelations, null, 2));
    } catch (error) {
      console.error('查询失败:', error);
    }
  }

  /**
   * 示例3：嵌套关联查询
   */
  async exampleNestedRelations(): Promise<void> {
    console.log('\n=== 示例3：嵌套关联查询 ===');

    try {
      // 查询用户并预加载文章的分类和评论
      const userWithNestedRelations = await this.orm.Session(User).With(['articles.category', 'articles.comments']).Where('id', 1).FirstWithRelations();
      console.log('用户及嵌套关联信息:', JSON.stringify(userWithNestedRelations, null, 2));
    } catch (error) {
      console.error('查询失败:', error);
    }
  }

  /**
   * 示例4：预加载查询用户和档案
   */
  async examplePreloadUserProfile(): Promise<void> {
    console.log('\n=== 示例4：预加载查询用户和档案 ===');

    try {
      // 查询所有用户并预加载档案信息
      const usersWithProfile = await this.orm.Session(User)
        .With('profile')
        .FindWithRelations();

      console.log('用户和档案信息:', JSON.stringify(usersWithProfile, null, 2));
    } catch (error) {
      console.error('查询失败:', error);
    }
  }

  /**
   * 示例5：多对多关联查询
   */
  async exampleManyToManyRelation(): Promise<void> {
    console.log('\n=== 示例5：多对多关联查询 ===');

    try {
      // 查询用户的角色
      const userWithRoles = await this.orm.Session(User)
        .With('roles')
        .Where('id', 1)
        .FirstWithRelations();

      console.log('用户及角色信息:', JSON.stringify(userWithRoles, null, 2));
    } catch (error) {
      console.error('多对多查询失败:', error);
    }
  }

  /**
   * 示例6：条件关联查询
   */
  async exampleConditionalRelation(): Promise<void> {
    console.log('\n=== 示例6：条件关联查询 ===');

    try {
      // 查询用户及其已发布的文章
      const userWithPublishedArticles = await this.orm.Session(User)
        .With('articles')
        .Where('id', 1)
        .FirstWithRelations();

      console.log('用户及已发布文章:', JSON.stringify(userWithPublishedArticles, null, 2));
    } catch (error) {
      console.error('条件关联查询失败:', error);
    }
  }

  /**
   * 示例7：分页关联查询
   */
  async examplePaginatedRelation(): Promise<void> {
    console.log('\n=== 示例7：分页关联查询 ===');

    try {
      // 分页查询用户及其文章
      const usersWithArticles = await this.orm.Session(User)
        .With('articles')
        .OrderByDesc('created_at')
        .Limit(10)
        .Offset(0)
        .FindWithRelations();

      console.log('分页查询结果:', JSON.stringify(usersWithArticles, null, 2));
    } catch (error) {
      console.error('分页关联查询失败:', error);
    }
  }

  /**
   * 示例8：反向关联查询
   */
  async exampleBelongsToRelation(): Promise<void> {
    console.log('\n=== 示例8：反向关联查询 ===');

    try {
      // 查询文章及其作者信息
      const articleWithAuthor = await this.orm.Session(Article)
        .With('author')
        .Where('id', 1)
        .FirstWithRelations();

      console.log('文章及作者信息:', JSON.stringify(articleWithAuthor, null, 2));
    } catch (error) {
      console.error('反向关联查询失败:', error);
    }
  }

  /**
   * 运行所有示例
   */
  async runAllExamples(): Promise<void> {
    console.log('开始运行关联查询示例...\n');

    try {
      await this.initializeData();
      await this.examplePreloadSingleRelation();
      await this.examplePreloadMultipleRelations();
      await this.exampleNestedRelations();
      await this.examplePreloadUserProfile();
      await this.exampleManyToManyRelation();
      await this.exampleConditionalRelation();
      await this.examplePaginatedRelation();
      await this.exampleBelongsToRelation();

      console.log('\n所有关联查询示例完成！');
      this.cleanupData();
    } catch (error) {
      console.error('示例运行过程中发生错误:', error);
    }
  }

  /**
   * 清理示例数据
   */
  cleanupData(): void {
    console.log('=== 清理示例数据 ===');

    try {
      this.orm.Session(Comment).Delete();
      this.orm.Session(Article).Delete();
      this.orm.Session(UserProfile).Delete();
      this.orm.Session(User).Delete();
      this.orm.Session(Category).Delete();
      this.orm.Session(Role).Delete();

      console.log('示例数据清理完成');
    } catch (error) {
      console.error('数据清理失败:', error);
    }
  }
}