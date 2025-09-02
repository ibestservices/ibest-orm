import { Class } from "../decorator/Index";
import { RelationType, CascadeType } from "../decorator/Relation";
import { AnyType } from "../model/Global.type";

/**
 * 关联查询选项
 */
export interface RelationQueryOptions {
  /** 是否预加载 */
  preload?: boolean;
  /** 查询条件 */
  where?: Record<string, AnyType>;
  /** 排序 */
  orderBy?: string;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 选择字段 */
  select?: string[];
}

/**
 * 关联数据加载状态
 */
export enum LoadingState {
  NotLoaded = 'notLoaded',
  Loading = 'loading',
  Loaded = 'loaded',
  Error = 'error'
}

/**
 * 关联数据包装器
 */
export class RelationWrapper<T = AnyType> {
  private _data: T | T[] | null = null;
  private _state: LoadingState = LoadingState.NotLoaded;
  private _error: string | null = null;

  constructor(
    private _loader: () => Promise<T | T[]>,
    private _isArray: boolean = false
  ) {}

  /**
   * 获取数据（触发延迟加载）
   */
  async get(): Promise<T | T[] | null> {
    if (this._state === LoadingState.Loaded) {
      return this._data;
    }

    if (this._state === LoadingState.Loading) {
      // 等待加载完成
      while (this._state === LoadingState.Loading) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return this._data;
    }

    try {
      this._state = LoadingState.Loading;
      this._data = await this._loader();
      this._state = LoadingState.Loaded;
      return this._data;
    } catch (error) {
      this._state = LoadingState.Error;
      this._error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * 同步获取数据（如果已加载）
   */
  getValue(): T | T[] | null {
    return this._data;
  }

  /**
   * 获取加载状态
   */
  getState(): LoadingState {
    return this._state;
  }

  /**
   * 获取错误信息
   */
  getError(): string | null {
    return this._error;
  }

  /**
   * 是否已加载
   */
  isLoaded(): boolean {
    return this._state === LoadingState.Loaded;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this._data = null;
    this._state = LoadingState.NotLoaded;
    this._error = null;
  }

  /**
   * 设置数据（用于预加载）
   */
  setData(data: T | T[]): void {
    this._data = data;
    this._state = LoadingState.Loaded;
    this._error = null;
  }
}

/**
 * 关联映射表项
 */
export interface RelationMapping {
  /** 源实体类 */
  sourceClass: Class;
  /** 目标实体类 */
  targetClass: Class;
  /** 关联类型 */
  type: RelationType;
  /** 属性名 */
  propertyKey: string;
  /** 外键 */
  foreignKey: string;
  /** 本地键 */
  localKey: string;
  /** 中间表信息（多对多） */
  through?: {
    table: string;
    foreignKey: string;
    otherKey: string;
  };
  /** 级联操作 */
  cascade: CascadeType[];
  /** 是否延迟加载 */
  lazy: boolean;
}

/**
 * 关联查询结果
 */
export interface RelationQueryResult<T = AnyType> {
  /** 主数据 */
  data: T[];
  /** 关联数据映射 */
  relations: Map<string, Map<AnyType, AnyType>>;
  /** 查询统计 */
  stats?: {
    totalQueries: number;
    executionTime: number;
  };
}