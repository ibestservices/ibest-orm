/**
 * 工具函数测试
 */

import { camelToSnake, snakeToCamel, classToTable, propertyToColumn } from '../utils';

describe('命名转换工具', () => {
  describe('camelToSnake', () => {
    it('应该转换普通驼峰', () => {
      expect(camelToSnake('createdAt')).toBe('created_at');
      expect(camelToSnake('userName')).toBe('user_name');
    });

    it('应该处理全大写', () => {
      expect(camelToSnake('ID')).toBe('id');
      expect(camelToSnake('UUID')).toBe('uuid');
    });

    it('应该处理混合情况', () => {
      expect(camelToSnake('userID')).toBe('user_id');
      expect(camelToSnake('getUserByID')).toBe('get_user_by_id');
    });

    it('应该处理空字符串', () => {
      expect(camelToSnake('')).toBe('');
    });
  });

  describe('snakeToCamel', () => {
    it('应该转换蛇形命名', () => {
      expect(snakeToCamel('created_at')).toBe('createdAt');
      expect(snakeToCamel('user_name')).toBe('userName');
    });

    it('应该处理空字符串', () => {
      expect(snakeToCamel('')).toBe('');
    });
  });

  describe('classToTable', () => {
    it('应该转换类名为表名', () => {
      expect(classToTable('User')).toBe('user');
      expect(classToTable('UserProfile')).toBe('user_profile');
    });
  });

  describe('propertyToColumn', () => {
    it('应该转换属性名为字段名', () => {
      expect(propertyToColumn('createdAt')).toBe('created_at');
      expect(propertyToColumn('id')).toBe('id');
    });
  });
});

// 简单的测试运行器
function describe(name: string, fn: () => void) {
  console.log(`\n=== ${name} ===`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    }
  };
}

// 运行测试
export function runUtilsTests() {
  describe('命名转换工具', () => {
    describe('camelToSnake', () => {
      it('应该转换普通驼峰', () => {
        expect(camelToSnake('createdAt')).toBe('created_at');
        expect(camelToSnake('userName')).toBe('user_name');
      });

      it('应该处理全大写', () => {
        expect(camelToSnake('ID')).toBe('id');
      });

      it('应该处理空字符串', () => {
        expect(camelToSnake('')).toBe('');
      });
    });

    describe('snakeToCamel', () => {
      it('应该转换蛇形命名', () => {
        expect(snakeToCamel('created_at')).toBe('createdAt');
      });
    });
  });
}
