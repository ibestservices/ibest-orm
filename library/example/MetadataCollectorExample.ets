import {
  Table, Field, FieldType, Model,
  HasOne, HasMany, BelongsTo, ManyToMany,
  RelationType, CascadeType
} from '../Index';
import { getMetadataCollector } from '../src/main/ets/core/MetadataCollector';
import { RelationQueryBuilder } from '../src/main/ets/core/RelationQueryBuilder';
import { GetColumnMeta } from '../src/main/ets/decorator/Index';

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
}

@Table({ name: 'user_profiles' })
class UserProfile extends Model {
  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  user_id?: number;

  @Field({ type: FieldType.TEXT })
  avatar?: string;

  @BelongsTo({
    target: () => User,
    foreignKey: 'user_id',
    localKey: 'id'
  })
  user?: User;
}

@Table({ name: 'articles' })
class Article extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  title?: string;

  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  author_id?: number;

  @BelongsTo({
    target: () => User,
    foreignKey: 'author_id',
    localKey: 'id'
  })
  author?: User;

  @HasMany({
    target: () => Comment,
    foreignKey: 'article_id',
    localKey: 'id'
  })
  comments?: Comment[];
}

@Table({ name: 'comments' })
class Comment extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  content?: string;

  @Field({ type: FieldType.INTEGER, tag: ['notNull'] })
  article_id?: number;

  @BelongsTo({
    target: () => Article,
    foreignKey: 'article_id',
    localKey: 'id'
  })
  article?: Article;
}

@Table({ name: 'roles' })
class Role extends Model {
  @Field({ type: FieldType.TEXT, tag: ['notNull'] })
  name?: string;

  @ManyToMany({
    target: () => User,
    through: 'user_roles',
    throughForeignKey: 'role_id',
    throughOtherKey: 'user_id'
  })
  users?: User[];
}

/**
 * 元数据收集器测试类
 */
export class MetadataCollectorTest {
  /**
   * 测试单个实体注册
   */
  static testSingleEntityRegistration(): void {
    console.log('=== 测试单个实体注册 ===');

    const meta = GetColumnMeta(User);
    console.log('meta:', JSON.stringify(meta));

    const collector = getMetadataCollector();
    collector.clear(); // 清空之前的数据

    // 注册User实体
    collector.collect(User);

    const stats = collector.getStats();
    console.log('注册统计:', JSON.stringify(stats, null, 2));

    // 验证关联映射
    const relationManager = collector.getRelationManager();
    const userMappings = relationManager.getRelationMappingList(User);

    console.log(`User实体的关联数量: ${userMappings.length}`);
    userMappings.forEach(mapping => {
      console.log(`- ${mapping.propertyKey}: ${mapping.type} -> ${mapping.targetClass.name}`);
    });
  }

  /**
   * 测试批量实体注册
   */
  static testBatchEntityRegistration(): void {
    console.log('\n=== 测试批量实体注册 ===');

    const collector = getMetadataCollector();
    collector.clear();

    // 批量注册所有实体
    collector.collect(User);
    collector.collect(UserProfile);
    collector.collect(Article);
    collector.collect(Comment);
    collector.collect(Role);

    const stats = collector.getStats();
    console.log('批量注册统计:', JSON.stringify(stats, null, 2));

    // 验证所有实体的关联
    const relationManager = collector.getRelationManager();
    const entities = [User, UserProfile, Article, Comment, Role];

    entities.forEach(entityClass => {
      const mappings = relationManager.getRelationMappingList(entityClass);
      console.log(`${entityClass.name} 关联数量: ${mappings.length}`);

      mappings.forEach(mapping => {
        console.log(`  - ${mapping.propertyKey}: ${mapping.type} -> ${mapping.targetClass.name}`);
        console.log(`    外键: ${mapping.foreignKey}, 本地键: ${mapping.localKey}`);
        if (mapping.through) {
          console.log(`    中间表: ${mapping.through.table}`);
        }
      });
    });
  }

  /**
   * 测试关联路径解析
   */
  static testRelationPathResolution(): void {
    console.log('\n=== 测试关联路径解析 ===');

    const collector = getMetadataCollector();
    collector.clear();

    collector.collect(User);
    collector.collect(UserProfile);
    collector.collect(Article);
    collector.collect(Comment);
    collector.collect(Role);

    const relationManager = collector.getRelationManager();

    try {
      // 测试简单路径
      const simplePath = relationManager.getRelationPath(User, 'profile');
      console.log('简单路径 User.profile:', simplePath.map(m => m.propertyKey));

      // 测试复杂路径
      const complexPath = relationManager.getRelationPath(User, 'articles.comments');
      console.log('复杂路径 User.articles.comments:', complexPath.map(m => m.propertyKey));

    } catch (error) {
      console.error('路径解析错误:', error);
    }
  }

  /**
   * 测试反向关联索引
   */
  static testReverseRelationIndex(): void {
    console.log('\n=== 测试反向关联索引 ===');

    const collector = getMetadataCollector();
    collector.clear();

    collector.collect(User);
    collector.collect(UserProfile);
    collector.collect(Article);
    collector.collect(Comment);
    collector.collect(Role);

    const relationManager = collector.getRelationManager();

    // 查找指向User的所有关联
    const relationsToUser = relationManager.getRelationsToTarget(User);
    console.log(`指向User的关联数量: ${relationsToUser.length}`);

    relationsToUser.forEach(mapping => {
      console.log(`- ${mapping.sourceClass.name}.${mapping.propertyKey} -> User (${mapping.type})`);
    });
  }

  /**
   * 测试关联配置验证
   */
  static testRelationValidation(): void {
    console.log('\n=== 测试关联配置验证 ===');

    const collector = getMetadataCollector();
    collector.clear();

    collector.collect(User);
    collector.collect(UserProfile);
    collector.collect(Article);
    collector.collect(Comment);
    collector.collect(Role);

    const validation = collector.validate();
    console.log(`验证结果: ${validation.isValid ? '通过' : '失败'}`);

    if (!validation.isValid) {
      console.log('验证错误:');
      validation.errors.forEach(error => {
        console.log(`- ${error}`);
      });
    }
  }

  /**
   * 测试关联查询构建器
   */
  static testRelationQueryBuilder(): void {
    console.log('\n=== 测试关联查询构建器 ===');

    const collector = getMetadataCollector();
    collector.clear();

    collector.collect(User);
    collector.collect(UserProfile);
    collector.collect(Article);
    collector.collect(Comment);
    collector.collect(Role);

    // 这里需要导入RelationQueryBuilder
    const queryBuilder = new RelationQueryBuilder(User);

    // 测试预加载配置
    queryBuilder.preload(['profile', 'articles', 'roles']);
    const preloadQueries = queryBuilder.buildPreloadQueries();

    console.log('预加载查询:', JSON.stringify(preloadQueries));
  }
}

/**
 * 运行所有测试
 */
export function runMetadataCollectorExample(): void {
  console.log('开始运行元数据收集器测试...\n');
  try {
    MetadataCollectorTest.testSingleEntityRegistration();
    MetadataCollectorTest.testBatchEntityRegistration();
    MetadataCollectorTest.testRelationPathResolution();
    MetadataCollectorTest.testReverseRelationIndex();
    MetadataCollectorTest.testRelationValidation();
    MetadataCollectorTest.testRelationQueryBuilder();

    console.log('\n所有测试完成！');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}
