/**
 * 数据验证器
 */

import { Class } from '../types';

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * 验证规则
 */
export interface ValidationRule {
  rule: string;
  message?: string;
  params?: unknown[];
}

/**
 * 字段验证元数据
 */
interface FieldValidation {
  propertyKey: string;
  rules: ValidationRule[];
}

/**
 * 验证元数据存储
 */
const validationStorage = new Map<Class, FieldValidation[]>();

/**
 * 添加验证规则
 */
function addValidationRule(target: Class, propertyKey: string, rule: ValidationRule): void {
  let fields = validationStorage.get(target);
  if (!fields) {
    fields = [];
    validationStorage.set(target, fields);
  }

  let field = fields.find(f => f.propertyKey === propertyKey);
  if (!field) {
    field = { propertyKey, rules: [] };
    fields.push(field);
  }

  field.rules.push(rule);
}

/**
 * @Required 装饰器 - 必填验证
 */
export function Required(message?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addValidationRule(target.constructor as Class, String(propertyKey), {
      rule: 'required',
      message: message || `${String(propertyKey)} 不能为空`
    });
  };
}

/**
 * @Length 装饰器 - 长度验证
 */
export function Length(min: number, max?: number, message?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addValidationRule(target.constructor as Class, String(propertyKey), {
      rule: 'length',
      message: message || (max ? `${String(propertyKey)} 长度应在 ${min}-${max} 之间` : `${String(propertyKey)} 长度至少 ${min}`),
      params: [min, max]
    });
  };
}

/**
 * @Range 装饰器 - 数值范围验证
 */
export function Range(min: number, max: number, message?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addValidationRule(target.constructor as Class, String(propertyKey), {
      rule: 'range',
      message: message || `${String(propertyKey)} 应在 ${min}-${max} 之间`,
      params: [min, max]
    });
  };
}

/**
 * @Pattern 装饰器 - 正则验证
 */
export function Pattern(regex: RegExp, message?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addValidationRule(target.constructor as Class, String(propertyKey), {
      rule: 'pattern',
      message: message || `${String(propertyKey)} 格式不正确`,
      params: [regex]
    });
  };
}

/**
 * @Email 装饰器 - 邮箱验证
 */
export function Email(message?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addValidationRule(target.constructor as Class, String(propertyKey), {
      rule: 'email',
      message: message || `${String(propertyKey)} 邮箱格式不正确`
    });
  };
}

/**
 * @Min 装饰器 - 最小值验证
 */
export function Min(value: number, message?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addValidationRule(target.constructor as Class, String(propertyKey), {
      rule: 'min',
      message: message || `${String(propertyKey)} 不能小于 ${value}`,
      params: [value]
    });
  };
}

/**
 * @Max 装饰器 - 最大值验证
 */
export function Max(value: number, message?: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addValidationRule(target.constructor as Class, String(propertyKey), {
      rule: 'max',
      message: message || `${String(propertyKey)} 不能大于 ${value}`,
      params: [value]
    });
  };
}

/**
 * 验证实体
 */
export function validate<T extends object>(entity: T): ValidationResult {
  const entityClass = entity.constructor as Class;
  const fields = validationStorage.get(entityClass);
  const errors: ValidationError[] = [];

  if (!fields) {
    return { valid: true, errors: [] };
  }

  for (const field of fields) {
    const value = (entity as Record<string, unknown>)[field.propertyKey];

    for (const rule of field.rules) {
      const error = validateRule(field.propertyKey, value, rule);
      if (error) {
        errors.push(error);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证单个规则
 */
function validateRule(field: string, value: unknown, rule: ValidationRule): ValidationError | null {
  switch (rule.rule) {
    case 'required':
      if (value === undefined || value === null || value === '') {
        return { field, message: rule.message!, rule: rule.rule };
      }
      break;

    case 'length':
      if (typeof value === 'string') {
        const [min, max] = rule.params as [number, number | undefined];
        if (value.length < min || (max !== undefined && value.length > max)) {
          return { field, message: rule.message!, rule: rule.rule };
        }
      }
      break;

    case 'range':
      if (typeof value === 'number') {
        const [min, max] = rule.params as [number, number];
        if (value < min || value > max) {
          return { field, message: rule.message!, rule: rule.rule };
        }
      }
      break;

    case 'pattern':
      if (typeof value === 'string') {
        const [regex] = rule.params as [RegExp];
        if (!regex.test(value)) {
          return { field, message: rule.message!, rule: rule.rule };
        }
      }
      break;

    case 'email':
      if (typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { field, message: rule.message!, rule: rule.rule };
        }
      }
      break;

    case 'min':
      if (typeof value === 'number') {
        const [min] = rule.params as [number];
        if (value < min) {
          return { field, message: rule.message!, rule: rule.rule };
        }
      }
      break;

    case 'max':
      if (typeof value === 'number') {
        const [max] = rule.params as [number];
        if (value > max) {
          return { field, message: rule.message!, rule: rule.rule };
        }
      }
      break;
  }

  return null;
}

/**
 * 清除验证元数据
 */
export function clearValidationMetadata(): void {
  validationStorage.clear();
}
