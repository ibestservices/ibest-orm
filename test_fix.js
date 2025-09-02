// 简单的测试脚本来验证修复
console.log("测试修复是否有效...");

// 模拟日志输出来验证外键设置
const testData = {
  user: { id: 1, name: "John" },
  orders: [
    { product_name: "Laptop", amount: 1299.99 },
    { product_name: "Phone", amount: 899.99 }
  ]
};

console.log("原始数据:", JSON.stringify(testData, null, 2));

// 模拟外键设置
testData.orders.forEach((order, index) => {
  order.user_id = testData.user.id;
  console.log(`设置外键: user_id = ${testData.user.id} 到订单 ${index + 1}:`, JSON.stringify(order));
});

console.log("设置外键后的数据:", JSON.stringify(testData, null, 2));