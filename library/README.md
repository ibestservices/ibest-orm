<p align="center">
    <img src="https://ibestservices.github.io/ibest-ui/AppScope/resources/base/media/app_logo_trans.png" width="100">
</p>

<p align="center">IBest-ORM</p>

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

## 特性
- 🗄️ **全功能 ORM** - 完整的对象关系映射功能
- 🔗 **关联查询** - 支持关联，多态，单表继承
- 📚 **丰富文档** - 提供详尽的中文文档和使用示例
- ⚡ **预加载支持** - 高效的数据预加载机制
- 🔒 **事务管理** - 完整的事务支持，确保数据一致性
- 📦 **批量操作** - 支持批量插入、更新、删除
- 🏗️ **数据库约束** - 主键，索引，约束完整支持
- 🔄 **自动迁移** - 智能的数据库结构迁移
- ⛓️ **链式调用** - 优雅的方法链式调用语法
- 🛡️ **类型安全** - 基于TypeScript的类型安全保障
- 🎨 **装饰器支持** - 简洁的装饰器语法定义模型
- ⚠️ **错误处理** - 完善的错误处理机制
- ✅ **测试覆盖** - 每个特性都经过了测试的重重考验
- 👨‍💻 **开发者友好** - 简单易用，上手快速

## 下载安装

```ts
ohpm install @ibestservices/ibest-orm
```

OpenHarmony ohpm 环境配置等更多内容，请参考[如何安装 OpenHarmony ohpm 包](https://gitee.com/openharmony-tpc/docs/blob/master/OpenHarmony_har_usage.md)

## 快速上手

### 1. 初始化
在应用启动时初始化IBest-ORM：

```ts
import { IBestORMInit } from '@ibestservices/ibest-orm';

onWindowStageCreate(windowStage: window.WindowStage): void {
  windowStage.loadContent('pages/Index', (err, data) => {
    // 初始化IBest-ORM
    IBestORMInit(this.context, {
        name: "database.db",
        securityLevel: relationalStore.SecurityLevel.S1
    })
  })
}
```

### 2. 定义模型
使用装饰器定义数据模型：

```ts
import { Table, Field, FieldType, Model } from '@ibestservices/ibest-orm';

@Table
export class User extends Model {
  /**
   * 名字
   */
  @Field({ type: FieldType.TEXT })
  Name?: string
  /**
   * 年龄
   */
  @Field({ type: FieldType.INTEGER })
  Age?: number

  constructor(name: string, age: number) {
    super();
    this.Name = name
    this.Age = age
  }
}
```

### 3. 基本使用
```ts
import { GetIBestORM } from '@ibestservices/ibest-orm';
import { relationalStore } from '@kit.ArkData';

@Entry
@Component
export struct DemoPage {
  private db = GetIBestORM();

  onPageShow(){
    // 自动迁移表结构
    this.db.AutoMigrate(User);
    
    // 创建记录
    const user = new User("zhangsan", 18);
    this.db.Create(user);

    // 使用ValuesBucket插入
    const valueBucket: relationalStore.ValuesBucket = {
      Name: 'ming',
      Age: 18,
    };
    this.db.Table("User").Insert(valueBucket);
    
    // 查询数据
    let result = this.db.Table("User").Where('age', 18).Find();
    
    // 更新数据
    this.db.Table("User").Where('name', 'ming').Update({ age: 20 });
    
    // 删除数据
    this.db.Table("User").Where('id', 1).Delete();
  }

  build(){}
}
```

## 核心功能

### 🔍 查询操作
```ts
// 条件查询
this.db.Table("User").Where('age', 18).Find();
this.db.Table("User").Where('name', 'like', '张%').Find();
this.db.Table("User").Between('age', 18, 25).Find();

// 排序和分页
this.db.Table("User").OrderByDesc('age').Limit(10).Offset(0).Find();

// 选择字段
this.db.Table("User").Select(['name', 'age']).Find();
```

### ✏️ 更新操作
```ts
// 条件更新
this.db.Table("User").Where('id', 1).Update({ name: 'newName' });

// 选择性更新
this.db.Table("User").Select(['name']).Where('id', 1).Update({ name: 'John', age: 25 });
```

### 🗑️ 删除操作
```ts
// 条件删除
this.db.Table("User").Where('age', '<', 18).Delete();

// 根据主键删除
this.db.DeleteByKey(User, 1);
this.db.DeleteByKey(User, [1, 2, 3]); // 批量删除
```

### 🔄 事务管理
```ts
this.db.Begin();
try {
  this.db.Create(user1);
  this.db.Create(user2);
  this.db.Commit();
} catch (error) {
  this.db.Rollback();
}
```

### 🔧 数据库迁移
```ts
// 自动迁移
this.db.AutoMigrate(User);

// 手动迁移
this.db.Migrator().CreateTable(User);
this.db.Migrator().AddColumn(User);
this.db.Migrator().HasTable(User);
```

## 高级特性

### 🏷️ 字段标签
IBest-ORM 支持丰富的字段标签来定义数据库约束：

```ts
@Table
export class User extends Model {
  @Field({ 
    type: FieldType.INTEGER, 
    tag: ['primaryKey', 'autoIncrement', 'notNull'] 
  })
  ID?: number

  @Field({ 
    type: FieldType.TEXT, 
    name: 'user_name',
    tag: ['notNull'] 
  })
  Name?: string

  @Field({ 
    type: FieldType.TEXT, 
    tag: ['autoCreateTime', 'notNull'] 
  })
  CreatedAt?: string
}
```

**支持的标签：**
- `primaryKey` - 定义为主键
- `notNull` - 字段不为空
- `autoIncrement` - 自增列
- `autoCreateTime` - 追踪创建时间
- `autoUpdateTime` - 追踪更新时间

### 🔗 方法链式调用
IBest-ORM 支持优雅的链式调用语法：

```ts
// 复杂查询示例
let users = this.db.Table("User")
  .Where('age', '>=', 18)
  .Where('status', 'active')
  .Or()
  .Where('vip_level', '>', 3)
  .OrderByDesc('created_at')
  .Select(['name', 'age', 'email'])
  .Limit(20)
  .Offset(0)
  .Find();
```

### ⚠️ 错误处理
```ts
// 检查操作是否成功
this.db.Create(user);
if (this.db.GetError()) {
  console.error('创建用户失败:', this.db.GetError());
} else {
  console.log('用户创建成功');
}
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