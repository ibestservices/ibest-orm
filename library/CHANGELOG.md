# 版本记录

## 1.1.0
新增：
1. 关联关系的装饰器方法：@HasOne、@HasMany、@BelongsTo和@ManyToMany；
2. 预加载支持：With、Preload、FirstWithRelations和FindWithRelations方法；
3. 延迟加载支持：EnableLazyLoading、PreloadRelation、LoadRelation、GetLoadedRelation、IsRelationLoaded和ReloadRelation方法；
4. 级联操作支持：Create、DeleteByEntity和Save方法新增支持级联操作的控制参数；

Bug修复：
1. 多个继承Model的实体类会污染其他字段；

## 1.0.0 初版