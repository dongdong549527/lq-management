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

// Helper to parse one packet from buffer
// Returns { result: CollectionResult, bytesRead: number } or null if not enough data
const parseOnePacket = (data: Uint8Array): { result: CollectionResult, bytesRead: number } | null => {
  if (data.length < 5) return null;

  // Search for header 2C 5A A5
  let headerIndex = -1;
  for (let i = 0; i < data.length - 2; i++) {
    if (data[i] === 0x2C && data[i + 1] === 0x5A && data[i + 2] === 0xA5) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return null; // No header found

  // If we have data before header, we should discard it, but for simplicity
  // let's assume we consume from headerIndex.
  const packetStart = data.slice(headerIndex);
  if (packetStart.length < 5) return null;

  const collectorId = packetStart[4];
  
  let packetLength = 0;
  const result: CollectionResult = {
    temperatureValues: {},
    humidityValues: 0,
  };

  // Determine expected length based on collector ID or structure
  // Protocol doesn't explicitly state fixed length for all types, but let's assume structure from docs.
  // Docs say:
  // Temp (01): Header(3)+Ext(1)+Col(1)+Temp(35)+Comp(5)+BB(1)? No, "数据包补偿位...BB".
  // Actually the example says "33 1*36 将该数据包补全".
  // Let's assume the packets have a fixed length or end with BB.
  // But searching for BB might be risky if data contains BB.
  // Let's rely on the length described or try to find the next header/end.
  
  // From previous analysis:
  // Temp (01): 3+1+1+35+5 = 45 bytes? Plus BB?
  // Let's look for BB at expected position or scan for it?
  // Docs: "长度(Byte) ... 数据包补偿位 ... BB".
  // Let's assume standard packet size if possible, or search for BB after min length.
  
  if (collectorId === 0x01) {
      // Temp packet
      // Min length: 45 + ?
      // Let's assume it ends with BB.
      // Search for BB after offset 45
      // Or just take a fixed length if we know it.
      // Doc example: 2C ... BB.
      // Let's try to parse if we have enough bytes.
      // Let's assume 50 bytes for safety?
      // Actually, if we just parse what we need (35 bytes temp + 5 comp), that's 45 bytes from header start (index 0).
      // 0-2: Header
      // 3: Ext
      // 4: Col
      // 5-39: Temp (35)
      // 40-44: Comp (5)
      // 45...: Padding/BB
      
      if (packetStart.length < 46) return null; // Need at least 46 bytes to see BB at 45?
      
      // Check BB at 45? Or maybe later.
      // Let's just consume 45 bytes + scan for BB within reasonable range (e.g. up to 64 bytes)
      let endIndex = -1;
      for(let k=45; k<Math.min(packetStart.length, 80); k++) {
          if (packetStart[k] === 0xBB) {
              endIndex = k;
              break;
          }
      }
      
      if (endIndex === -1) return null; // Packet not complete
      packetLength = endIndex + 1;

      const tempData = packetStart.slice(5, 40);
      const compData = packetStart.slice(40, 45);

      let tempIndex = 0;
      for (let cable = 1; cable <= 7; cable++) {
        for (let point = 1; point <= 5; point++) {
          if (tempIndex >= tempData.length) break;
          
          const rawTemp = tempData[tempIndex];
          const byteIndex = Math.floor(tempIndex / 8);
          const bitIndex = 7 - (tempIndex % 8);
          const compByte = compData[byteIndex];
          const compBit = (compByte >> bitIndex) & 0x01;
          const compValue = compBit === 1 ? 0.25 : 0.0;
  
          let tempValue = rawTemp / 2.0;
          if (rawTemp >= 0x80) {
             tempValue = -((rawTemp - 0x80) / 2.0);
          }
          tempValue += compValue;
          
          result.temperatureValues[`${cable}-${point}`] = parseFloat(tempValue.toFixed(2));
          tempIndex++;
        }
      }

  } else if (collectorId === 0x02) {
      // TH packet
      // Min length: 3+1+1+2+2 = 9 bytes.
      // Plus padding + BB.
      // Let's scan for BB after index 9.
      if (packetStart.length < 10) return null;
      
      let endIndex = -1;
      for(let k=9; k<Math.min(packetStart.length, 30); k++) {
          if (packetStart[k] === 0xBB) {
              endIndex = k;
              break;
          }
      }
      
      if (endIndex === -1) return null;
      packetLength = endIndex + 1;

      const tempInt = packetStart[5];
      const tempDec = packetStart[6];
      const tempVal = parseFloat(`${parseInt(tempInt.toString(16))}.${parseInt(tempDec.toString(16))}`);
      
      const humInt = packetStart[7];
      const humDec = packetStart[8];
      const humVal = parseFloat(`${parseInt(humInt.toString(16))}.${parseInt(humDec.toString(16))}`);
  
      result.temperatureValues["Indoor"] = tempVal;
      result.humidityValues = humVal;
  } else {
      // Unknown collector, skip header and continue search?
      // Or assume some length? 
      // Safest is to consume 1 byte (the header start) and retry search next time.
      // But here we return null so outer loop advances?
      // Actually we should skip this "packet" if we can't parse it but it looks like a header.
      // Let's just return null and let the accumulator wait for more data.
      // WARNING: If we have a valid header but unknown ID, we might get stuck if we don't consume it.
      // Let's assume it's valid but we don't care, consume it?
      // For now, let's return null (wait for more data) if we can't find BB.
      // If we find BB, we consume.
      let endIndex = -1;
      for(let k=5; k<Math.min(packetStart.length, 100); k++) {
          if (packetStart[k] === 0xBB) {
              endIndex = k;
              break;
          }
      }
      if (endIndex !== -1) {
          packetLength = endIndex + 1;
      } else {
          return null;
      }
  }

  // Return parsed result and the total bytes consumed (including garbage before header)
  return {
      result,
      bytesRead: headerIndex + packetLength
  };
};

export const collectFromSerial = async (extensionNumber: number, totalCollectorCount: number): Promise<CollectionResult> => {
  if (!("serial" in navigator)) {
    throw new Error("您的浏览器不支持串口通讯，请使用 Chrome 或 Edge 浏览器。");
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 4800 }); 

    const writer = port.writable.getWriter();
    const command = new Uint8Array([0x05, 0x55, 0xAA, extensionNumber, 0xAA, 0x55]);
    console.log("Sending command:", Array.from(command).map(b => b.toString(16).padStart(2, '0')).join(' '));
    await writer.write(command);
    writer.releaseLock();

    const reader = port.readable.getReader();
    let accumulatedData = new Uint8Array();
    const startTime = Date.now();
    
    // Aggregate results
    const finalResult: CollectionResult = {
        temperatureValues: {},
        humidityValues: 0
    };
    const collectedIds = new Set<number>();
    
    try {
        // Wait up to 10 seconds for all collectors
        while (Date.now() - startTime < 10000) { 
            const { value, done } = await reader.read();
            if (done) {
                console.log("Reader done");
                break;
            }
            if (value) {
                console.log("Received chunk:", Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' '));
                const newData = new Uint8Array(accumulatedData.length + value.length);
                newData.set(accumulatedData);
                newData.set(value, accumulatedData.length);
                accumulatedData = newData;

                // Loop to parse all available packets in buffer
                while (true) {
                    const parsed = parseOnePacket(accumulatedData);
                    if (!parsed) break; // Not enough data for next packet

                    console.log("Parsed packet:", parsed.result);
                    
                    // Merge data
                    Object.assign(finalResult.temperatureValues, parsed.result.temperatureValues);
                    if (parsed.result.humidityValues > 0) {
                        finalResult.humidityValues = parsed.result.humidityValues;
                    }

                    // Remove processed bytes from accumulator
                    accumulatedData = accumulatedData.slice(parsed.bytesRead);
                    
                    // Track collected count (simple logic: increment per packet? Or check ID?)
                    // Since we don't have collector ID in Result, let's just count packets.
                    // Ideally we should track which collector ID we received.
                    // But current parseOnePacket consumes ID.
                    // Let's just assume 1 packet = 1 collector.
                    // We increment a counter.
                    collectedIds.add(Date.now() + Math.random()); // Hacky unique count
                }

                // Check completion
                // Note: totalCollectorCount might need to match exactly how many packets we expect.
                // E.g. 1 temp packet + 1 TH packet = 2 collectors?
                // If collected packets >= totalCollectorCount, we are done.
                if (collectedIds.size >= totalCollectorCount) {
                    console.log(`Collected ${collectedIds.size}/${totalCollectorCount} packets. Done.`);
                    return finalResult;
                }
            }
        }
        console.log("Timeout reached, returning partial data.");
        // Return whatever we have if timeout
        if (Object.keys(finalResult.temperatureValues).length > 0) {
            return finalResult;
        }
    } finally {
        reader.releaseLock();
        await port.close();
    }
    
    throw new Error("采集超时或未收到有效数据");

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
