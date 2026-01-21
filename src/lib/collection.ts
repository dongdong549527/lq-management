import mqtt from "mqtt";

export interface CollectionConfig {
  collectionDevice: number; // 1: Serial, 2: Network Host, 3: Network Extension
  serialPort?: string; // Port name (not directly used by Web Serial API request, but good for reference)
  mqttTopicSub?: string;
  mqttTopicPub?: string;
  // MQTT Broker URL is not in DB config, we might need to ask user or use default
  mqttBrokerUrl?: string; 
}

export interface CollectionResult {
  temperatureValues: any;
  humidityValues: number;
}

// Helper to parse data (Mock implementation)
const parseData = (data: Uint8Array | string): CollectionResult => {
  // TODO: Implement actual protocol parsing here
  // This is a mock implementation that generates random data
  console.log("Raw data received:", data);
  
  const tempCount = 10;
  const temps: Record<string, number> = {};
  for (let i = 0; i < tempCount; i++) {
    temps[`T${i + 1}`] = 20 + Math.random() * 10;
  }

  return {
    temperatureValues: temps,
    humidityValues: 40 + Math.random() * 20,
  };
};

export const collectFromSerial = async (): Promise<CollectionResult> => {
  if (!("serial" in navigator)) {
    throw new Error("您的浏览器不支持串口通讯，请使用 Chrome 或 Edge 浏览器。");
  }

  try {
    // Request user to select a port
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 }); // Default baudrate, maybe configurable?

    const writer = port.writable.getWriter();
    // Send a mock command (e.g., Modbus read)
    const command = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD]);
    await writer.write(command);
    writer.releaseLock();

    // Read response
    const reader = port.readable.getReader();
    let receivedData = new Uint8Array();
    
    // Read loop (simplified for mock)
    try {
        const { value, done } = await reader.read();
        if (value) {
            receivedData = value;
        }
    } finally {
        reader.releaseLock();
        await port.close();
    }

    return parseData(receivedData);
  } catch (error: any) {
    console.error("Serial collection error:", error);
    throw new Error(error.message || "串口采集失败");
  }
};

export const collectFromMqtt = async (
  config: CollectionConfig,
  brokerUrl: string = "ws://localhost:8083/mqtt" // Default to local websocket broker
): Promise<CollectionResult> => {
  return new Promise((resolve, reject) => {
    if (!config.mqttTopicSub || !config.mqttTopicPub) {
      reject(new Error("未配置 MQTT 主题"));
      return;
    }

    const client = mqtt.connect(brokerUrl, {
        clientId: `client_${Math.random().toString(16).substring(2, 8)}`,
        keepalive: 60,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
    });

    const timeout = setTimeout(() => {
      client.end();
      reject(new Error("采集超时"));
    }, 10000);

    client.on("connect", () => {
      console.log("MQTT Connected");
      client.subscribe(config.mqttTopicSub!, (err) => {
        if (err) {
          clearTimeout(timeout);
          client.end();
          reject(new Error("订阅主题失败"));
        } else {
          // Send collection command
          const command = JSON.stringify({ action: "collect" });
          client.publish(config.mqttTopicPub!, command);
        }
      });
    });

    client.on("message", (topic, message) => {
      if (topic === config.mqttTopicSub) {
        clearTimeout(timeout);
        client.end();
        try {
          const data = message.toString();
          const result = parseData(data);
          resolve(result);
        } catch (e) {
          reject(new Error("数据解析失败"));
        }
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      client.end();
      reject(new Error(`MQTT 错误: ${err.message}`));
    });
  });
};
