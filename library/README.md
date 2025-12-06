<p align="center">
    <img src="https://ibestservices.github.io/ibest-ui/AppScope/resources/base/media/app_logo_trans.png" width="100">
</p>

<p align="center">IBest-ORM v2.0</p>

<p align="center">轻量、易用的 HarmonyOS NEXT 数据库工具库</p>

<p align="center">
    <a href="https://ibest-orm.ibestservices.com/" target="_blank">文档</a>
    &nbsp;
    ·
    &nbsp;
    <a href="https://ohpm.openharmony.cn/#/cn/detail/@ibestservices%2Fibest-orm" target="_blank">三方库中心仓</a>
</p>

---

## 介绍

IBest-ORM 由 <a style="color:#0366d6;" href="https://www.ibestservices.com/" target="_blank">安徽百得思维信息科技有限公司</a>
开源，是一个**轻量、简单易用、全功能、支持实体关联、事务、自动迁移**的鸿蒙开源 ORM 工具库, 上手简单，使用方便，可大大提高鸿蒙开发者的开发效率。

## v2.0 新特性

- 🗄️ **全功能 ORM** - 完整的对象关系映射功能
- 🔗 **关联查询** - 支持关联，多态，单表继承
- 🎯 **全新 API** - 更简洁的初始化和查询 API
- 🔍 **链式查询构建器** - 类型安全的 QueryBuilder
- ✅ **数据验证** - 内置验证装饰器（@Required, @Length, @Email 等）
- 🗑️ **软删除** - @SoftDelete 装饰器支持
- 💾 **查询缓存** - 可配置的查询结果缓存
- ⏰ **时间格式** - 可配置的时间戳格式（datetime, iso, timestamp 等）
- 🌍 **错误国际化** - 中英文错误信息支持
- 📝 **迁移日志** - 完整的迁移历史记录
- 🏗️ **数据库约束** - 主键，联合主键，索引，约束完整支持
- 🔄 **嵌套事务** - 支持事务深度跟踪
- ⚡ **预加载支持** - 高效的数据预加载机制
- 🚀 **延迟加载** - 关联数据按需加载
- ⚡ **级联操作** - 级联创建、更新、删除

## 下载安装

```ts
ohpm install @ibestservices/ibest-orm
```

OpenHarmony ohpm 环境配置等更多内容，请参考[如何安装 OpenHarmony ohpm 包](https://gitee.com/openharmony-tpc/docs/blob/master/OpenHarmony_har_usage.md)

## 快速上手

### 1. 初始化

```ts
import { initORM, createRelationalStoreAdapter } from '@ibestservices/ibest-orm';

onWindowStageCreate(windowStage: window.WindowStage): void {
  // 创建适配器
  const adapter = await createRelationalStoreAdapter(this.context, {
    name: 'app.db',
    securityLevel: relationalStore.SecurityLevel.S1
  });
  // 初始化 ORM
  initORM({ adapter, logLevel: 'debug' });
  windowStage.loadContent('pages/Index');
}
```

### 2. 定义模型

```ts
import { Table, Column, PrimaryKey, NotNull, CreatedAt, UpdatedAt } from '@ibestservices/ibest-orm';

@Table()
export class User {
  @PrimaryKey()
  id?: number;

  @Column()
  @NotNull()
  name?: string;

  @Column()
  age?: number;

  @CreatedAt()
  createdAt?: string;

  @UpdatedAt()
  updatedAt?: string;
}
```

### 3. 基本使用

```ts
import { getORM } from '@ibestservices/ibest-orm';

@Entry
@Component
export struct DemoPage {
  onPageShow() {
    const orm = getORM();

    // 同步表结构
    orm.sync(User);

    // 创建记录
    const user = new User();
    user.name = '张三';
    user.age = 18;
    orm.insert(user);

    // 查询数据
    const users = orm.query(User)
      .where({ age: { gte: 18 } })
      .orderBy('createdAt', 'desc')
      .find();

    // 更新数据
    orm.query(User)
      .where({ id: 1 })
      .update({ age: 20 });

    // 删除数据
    orm.deleteById(User, 1);
  }

  build() {}
}
```

## 核心功能

### 🔍 查询操作

```ts
const orm = getORM();

// 条件查询
orm.query(User).where({ age: 18 }).find();
orm.query(User).where({ name: { like: '张%' } }).find();
orm.query(User).whereBetween('age', 18, 25).find();

// 排序和分页
orm.query(User).orderBy('age', 'desc').limit(10).offset(0).find();

// 选择字段
orm.query(User).select('name', 'age').find();

// 聚合查询
orm.query(User).count();
orm.query(User).where({ status: 'active' }).exists();
```

### ✏️ 更新操作

```ts
// 条件更新
orm.query(User).where({ id: 1 }).update({ name: '李四' });

// 实体更新
const user = orm.query(User).where({ id: 1 }).first();
user.name = '王五';
orm.save(user);
```

### 🗑️ 删除操作

```ts
// 条件删除
orm.query(User).where({ age: { lt: 18 } }).delete();

// 根据主键删除
orm.deleteById(User, 1);
orm.deleteById(User, [1, 2, 3]);  // 批量删除
```

### 🔄 事务管理

```ts
// 回调式事务（推荐）
orm.transaction(() => {
  orm.insert(user1);
  orm.insert(user2);
  // 自动提交，出错自动回滚
});

// 手动事务
orm.beginTransaction();
try {
  orm.insert(user1);
  orm.insert(user2);
  orm.commit();
} catch (error) {
  orm.rollback();
}
```

### 🔧 数据库迁移

```ts
// 自动迁移（创建表、新增/删除/修改字段）
orm.sync(User);

// 查看迁移日志
const logs = orm.getMigrationLogs();
```

## 高级特性

### ✅ 数据验证

```ts
import { Required, Length, Email, Min, Max } from '@ibestservices/ibest-orm';

@Table()
class User {
  @PrimaryKey()
  id?: number;

  @Column()
  @Required()
  @Length(2, 20)
  name?: string;

  @Column()
  @Email()
  email?: string;

  @Column()
  @Min(0)
  @Max(150)
  age?: number;
}
```

### 🗑️ 软删除

```ts
import { SoftDelete } from '@ibestservices/ibest-orm';

@Table()
class Article {
  @PrimaryKey()
  id?: number;

  @SoftDelete()
  deletedAt?: string;
}

// 软删除
orm.query(Article).where({ id: 1 }).delete();

// 查询包含已删除
orm.query(Article).withTrashed().find();

// 恢复
orm.query(Article).where({ id: 1 }).restore();
```

### 🔗 关联查询

```ts
import { HasMany, BelongsTo } from '@ibestservices/ibest-orm';

@Table()
class Author {
  @PrimaryKey()
  id?: number;

  @HasMany(() => Book, 'authorId')
  books?: Book[];
}

@Table()
class Book {
  @PrimaryKey()
  id?: number;

  @Column()
  authorId?: number;

  @BelongsTo(() => Author, 'authorId')
  author?: Author;
}

// 预加载关联
const authors = orm.query(Author).with('books').find();
```

### 💾 查询缓存

```ts
import { initQueryCache, getQueryCache } from '@ibestservices/ibest-orm';

// 初始化缓存
initQueryCache({ maxSize: 100, ttl: 60000 });

const cache = getQueryCache();

// 缓存查询结果
const users = cache.get('active_users', () => {
  return orm.query(User).where({ status: 'active' }).find();
});

// 清除缓存
cache.invalidate('user');  // 清除 user 表相关缓存
```

### ⏰ 时间格式配置

```ts
import { setTimeFormat } from '@ibestservices/ibest-orm';

setTimeFormat('datetime');   // 2024-01-01 12:00:00
setTimeFormat('iso');        // 2024-01-01T12:00:00.000Z
setTimeFormat('timestamp');  // 1704067200000
```

### 🌍 错误国际化

```ts
import { setErrorLocale } from '@ibestservices/ibest-orm';

setErrorLocale('zh');  // 中文错误信息
setErrorLocale('en');  // 英文错误信息
```

## 使用注意事项

⚠️ **重要提醒**
- 由于API功能限制，不支持在预览器调试
- 请在**模拟器**或**真机**上调试
- 建议在应用启动时进行IBest-ORM初始化

## 链接
- [📖 在线文档](https://ibest-orm.ibestservices.com)
- [🐙 Github](https://github.com/ibestservices/ibest-orm)
- [🦄 Gitee](https://gitee.com/ibestservices/ibest-orm)
- [📋 更新日志](https://github.com/ibestservices/ibest-orm/releases)

## 交流QQ群
官方QQ群 953492584

![QQ1群](https://ibestservices.github.io/ibest-ui/screenshot/QQ%E7%BE%A4.jpg)

## 微信群
添加IBest-UI助手, 备注 "鸿蒙开发"
![微信群](https://ibestservices.github.io/ibest-ui/screenshot/IBest-UI助手.jpg)

## 约束与限制
在下述版本验证通过：
```text
DevEco Studio 5.0.5 Release
Build #DS-233.14475.28.36.5013200
构建版本：5.0.13.200, built on May 13, 2025
Runtime version: 17.0.12+1-b1087.25 x86_64
VM: OpenJDK 64-Bit Server VM by JetBrains s.r.o.
macOS 15.4.1
GC: G1 Young Generation, G1 Old Generation
Memory: 2048M
Cores: 12
Metal Rendering is ON
Registry:
  idea.plugins.compatible.build=IC-233.14475.28
Non-Bundled Plugins:
  com.alibabacloud.intellij.cosy (2.5.2)
  com.huawei.agc.ecomarket.component.plugin (233.14475.28)
  com.harmonyos.cases (1.0.10-Alpha)
```

## 开源协议
本项目基于 Apache License 2.0，请自由地享受和参与开源。

## 贡献者
感谢以下同学对IBest-ORM做的贡献:

<a href="https://github.com/ibestservices/ibest-orm/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ibestservices/ibest-orm" />
</a>
