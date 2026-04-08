// 配置管理文件

// 调试环境变量加载
console.log('=== MQTT Config Debug ===');
console.log('MQTT_BROKER_URL:', process.env.MQTT_BROKER_URL);
console.log('MQTT_USERNAME:', process.env.MQTT_USERNAME);
console.log('MQTT_PASSWORD:', process.env.MQTT_PASSWORD);

// MQTT 配置
export const mqttConfig = {
  brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://claw.540777.xyz:1883",
  username: process.env.MQTT_USERNAME || "admin",
  password: process.env.MQTT_PASSWORD || "admin"
};

console.log('Final MQTT config:', mqttConfig);

// 应用配置
export const appConfig = {
  // 其他应用配置...
};
