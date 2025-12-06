# 版本记录

## 2.0.0 (重构版本)

### 🎉 新特性

**核心架构**
- 新增 `MemoryAdapter` 支持预览器调试（开发测试基础ORM功能使用）
- 新增 `RelationalStoreAdapter` 封装鸿蒙原生数据库
- 优化 `IBestORMInit()` 简化初始化流程

**装饰器系统**
- `@Table()` - 表定义，支持自动推断表名
- `@Column()` - 列定义，支持自动推断类型
- `@PrimaryKey()` - 独立主键装饰器，支持复合主键
- `@NotNull()` - 非空约束
- `@CreatedAt()` / `@UpdatedAt()` - 自动时间戳
- `@SoftDelete()` - 软删除支持

**查询构建器**
- 链式查询 API：`query(Entity).where().orderBy().limit().find()`
- 对象风格条件：`{ age: { gte: 18, lte: 60 } }`
- 支持 `gt/gte/lt/lte/ne/like/in` 操作符
- `orWhere()` OR 条件查询
- `select()` 字段选择
- `orderBy()` 排序
- `limit()` / `offset()` 分页
- `groupBy()` 分组

**关联关系**
- `@HasOne` - 一对一
- `@HasMany` - 一对多
- `@BelongsTo` - 多对一
- `@ManyToMany` - 多对多
- `with()` 预加载，解决 N+1 问题
- `enableLazyLoading()` 延迟加载
- `CascadeType.Delete` 级联删除

**数据验证**
- `@Required` - 必填验证
- `@Length(min, max)` - 长度验证
- `@Range(min, max)` - 范围验证
- `@Min(value)` / `@Max(value)` - 最值验证
- `@Pattern(regex)` - 正则验证
- `@Email` - 邮箱验证

**事务管理**
- `beginTransaction()` / `commit()` / `rollback()`
- `transaction(async fn)` 回调式事务，自动提交/回滚
- 嵌套事务支持

**迁移系统**
- 新增字段自动添加
- 迁移日志记录
- 回滚 SQL 生成

**调试工具**
- `hasTable()` - 检查表是否存在
- `getTableInfo()` - 获取表结构信息
- `hasColumn()` - 检查列是否存在
- `getMigrationLogs()` - 获取迁移日志
- `getMigrationHistory()` - 查询迁移历史

**错误处理**
- 结构化错误码
- 中英文错误信息
- 包含解决建议

**日志系统**
- 支持 DEBUG/INFO/WARN/ERROR 级别
- SQL 执行日志
- 执行时间统计

**查询缓存**
- TTL 过期策略
- 按表名失效
- 可配置缓存大小

### ⚡ 优化

- 约定优于配置：驼峰自动转蛇形、`id` 自动识别为主键
- 类型自动推断：根据属性类型推断数据库列类型
- 批量操作优化：`insert([entities])` 批量插入
- 预加载优化：批量查询解决 N+1 问题

### 🗑️ 废弃

- 移除 `@Field` 装饰器，使用 `@Column` 替代
- 移除 `FieldType` 枚举，使用 `ColumnType` 替代
- 移除 `Model` 基类继承方式，使用装饰器定义
- 移除旧版 `Create/Update/Delete/Find` 等方法，使用 `insert/save/delete` 和查询构建器

---

## 1.1.0

新增：
1. 关联关系的装饰器方法：@HasOne、@HasMany、@BelongsTo和@ManyToMany；
2. 预加载支持：With、Preload、FirstWithRelations和FindWithRelations方法；
3. 延迟加载支持：EnableLazyLoading、PreloadRelation、LoadRelation、GetLoadedRelation、IsRelationLoaded和ReloadRelation方法；
4. 级联操作支持：Create、DeleteByEntity和Save方法新增支持级联操作的控制参数；

Bug修复：
1. 多个继承Model的实体类会污染其他字段；

## 1.0.0 初版
