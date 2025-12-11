/**
 * 测试入口
 */

import { runUtilsTests } from './utils.test';
import { runORMTests } from './orm.test';
import { runAllIntegrationTests, runIntegrationTests, runPerformanceTests } from './integration.test';

export function runAllTests() {
  console.log('========================================');
  console.log('  IBest-ORM Next 单元测试');
  console.log('========================================');

  runUtilsTests();
  runORMTests();

  console.log('========================================');
  console.log('  所有测试完成');
  console.log('========================================');
}

// 导出测试函数
export { runUtilsTests, runORMTests };
export { runAllIntegrationTests, runIntegrationTests, runPerformanceTests };
export type { IntegrationTestStats, PerformanceResult } from './integration.test';
export { RelationTestResult, RelationTestSuite, RelationTestStats, runRelationTests, getRelationTestStats } from './RelationTest';
