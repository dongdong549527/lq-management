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

// Helper to parse data based on protocol
const parseProtocolData = (data: Uint8Array): CollectionResult | null => {
  // Protocol Header: 2C 5A A5
  // We need at least header (3) + extension (1) + collector (1) + some data
  if (data.length < 5) return null;

  // Search for header
  let headerIndex = -1;
  for (let i = 0; i < data.length - 2; i++) {
    if (data[i] === 0x2C && data[i + 1] === 0x5A && data[i + 2] === 0xA5) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return null;

  const packet = data.slice(headerIndex);
  // Need at least 5 bytes to check collector ID
  if (packet.length < 5) return null;

  const collectorId = packet[4];
  const result: CollectionResult = {
    temperatureValues: {},
    humidityValues: 0,
  };

  if (collectorId === 0x01) {
    // Cable Temperature Data
    // Length check: 3 header + 1 ext + 1 col + 35 temp + 5 comp + 2 footer (BB) = 47 bytes?
    // Protocol says: 35 bytes temp data, 5 bytes compensation.
    // Let's assume minimum length.
    if (packet.length < 45) return null; // 5 + 35 + 5 = 45

    const tempData = packet.slice(5, 40); // 35 bytes
    const compData = packet.slice(40, 45); // 5 bytes

    let tempIndex = 0;
    // 7 cables, 5 points each
    for (let cable = 1; cable <= 7; cable++) {
      for (let point = 1; point <= 5; point++) {
        if (tempIndex >= tempData.length) break;
        
        const rawTemp = tempData[tempIndex];
        // Compensation logic
        // 5 bytes of compensation, total 40 bits. But we only have 35 points.
        // Bit mapping: byte 0 (bits 7-0) -> points 1-8?
        // Protocol example: "0001 1000 ... 0 means 0, 1 means 0.25"
        // Let's assume linear mapping: Point 1 is Byte 0 Bit 7 (or 0?), etc.
        // Usually it's Byte 0 Bit 0 -> Point 1, or Byte 0 Bit 7 -> Point 1.
        // Protocol says: "0001 1000 ...". First point corresponds to...
        // Let's assume Big Endian bit order for simplicity for now, or byte-aligned.
        // Actually, 35 points fit in 5 bytes (5 * 8 = 40 bits).
        
        const byteIndex = Math.floor(tempIndex / 8);
        const bitIndex = 7 - (tempIndex % 8); // High bit first?
        const compByte = compData[byteIndex];
        const compBit = (compByte >> bitIndex) & 0x01;
        const compValue = compBit === 1 ? 0.25 : 0.0;

        let tempValue = rawTemp / 2.0;
        // Check for > 80 (raw value > 160?)
        // Protocol: "If collected temp data >= 80, subtract 80".
        // 80 hex = 128 dec.
        if (rawTemp >= 128) {
           // This means raw value was X, but it represents negative?
           // "Subtract 80, result is negative or zero".
           // Example: raw 80 (128) -> 128 - 128 = 0.
           // raw 81 (129) -> 129 - 128 = 1? No, "negative or zero".
           // Maybe it means signed?
           // Let's follow "subtract 80 (hex? dec?)"
           // "大于等于80 (hex 0x50 = 80 dec? Or 80 hex?)"
           // Example says "value >= 80". Context usually implies Hex in this protocol.
           // If hex 80 (128 dec): (128 - 128)/2 = 0?
           // Let's assume standard offset.
           // Let's stick to simple logic: if (raw >= 128) tempValue = (raw - 128) / 2 * -1; ?
           // Protocol text: "value >= 80, subtract 80 ... result is negative or equal to 0"
           // If raw is 0x80 (128), 128-128 = 0.
           // If raw is 0x81 (129), 129-128 = 1. 1/2 = 0.5. Is it -0.5?
           // Let's assume it's a flag bit for negative.
           if (rawTemp >= 0x80) {
             tempValue = -((rawTemp - 0x80) / 2.0);
           }
        } else {
            tempValue = rawTemp / 2.0;
        }

        tempValue += compValue;
        
        result.temperatureValues[`${cable}-${point}`] = parseFloat(tempValue.toFixed(2));
        tempIndex++;
      }
    }
  } else if (collectorId === 0x02) {
    // TH Sensor Data
    // Header (3) + Ext (1) + Col (1) + Temp(2) + Hum(2) + ...
    if (packet.length < 9) return null;
    
    // Temp: Byte 5, 6
    const tempInt = packet[5];
    const tempDec = packet[6];
    const tempVal = parseFloat(`${parseInt(tempInt.toString(16))}.${parseInt(tempDec.toString(16))}`);
    // Protocol says "Directly convert to decimal".
    // Example: 1A (26) . 26 (38) -> 26.38.
    // This implies BCD-like or just concatenation of decimal strings?
    // "1A hex -> 26 dec", "26 hex -> 38 dec". Result 26.38.
    // So it treats the DECIMAL value of the byte as the value.
    
    // Humidity: Byte 7, 8
    const humInt = packet[7];
    const humDec = packet[8];
    const humVal = parseFloat(`${parseInt(humInt.toString(16))}.${parseInt(humDec.toString(16))}`);

    // Since we only have one field for humidityValues (number) in interface,
    // we'll just assign it. But for temp, we usually expect a map.
    // We can store indoor temp as "IN" or similar.
    result.temperatureValues["Indoor"] = tempVal;
    result.humidityValues = humVal;
  }

  return result;
};

export const collectFromSerial = async (extensionNumber: number): Promise<CollectionResult> => {
  if (!("serial" in navigator)) {
    throw new Error("您的浏览器不支持串口通讯，请使用 Chrome 或 Edge 浏览器。");
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 4800 }); 

    const writer = port.writable.getWriter();
    // Command: 05 55 AA [Extension] AA 55
    // Extension should be hex.
    const command = new Uint8Array([0x05, 0x55, 0xAA, extensionNumber, 0xAA, 0x55]);
    await writer.write(command);
    writer.releaseLock();

    const reader = port.readable.getReader();
    let accumulatedData = new Uint8Array();
    const startTime = Date.now();
    
    try {
        while (Date.now() - startTime < 3000) { // 3 seconds timeout
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                const newData = new Uint8Array(accumulatedData.length + value.length);
                newData.set(accumulatedData);
                newData.set(value, accumulatedData.length);
                accumulatedData = newData;

                // Try parsing
                const result = parseProtocolData(accumulatedData);
                if (result && Object.keys(result.temperatureValues).length > 0) {
                    return result;
                }
            }
        }
    } finally {
        reader.releaseLock();
        await port.close();
    }
    
    // If we have some data but loop finished
    const finalResult = parseProtocolData(accumulatedData);
    if (finalResult) return finalResult;

    throw new Error("采集超时或数据解析失败");

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
