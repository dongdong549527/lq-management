import mqtt from "mqtt";

export interface CollectionConfig {
  collectionDevice: number; // 1: Serial, 2: Network Host, 3: Network Extension
  serialPort?: string; 
  mqttTopicSub?: string;
  mqttTopicPub?: string;
  mqttBrokerUrl?: string; 
  extensionNumber?: number;
  totalCollectorCount?: number;
  startIndex?: number;
  endIndex?: number;
  indoorThIndex?: number;
  outdoorThIndex?: number;
}

export interface CollectionResult {
  temperatureValues: any;
  humidityValues: null; // Deprecated but kept for compatibility if needed, or just remove
}

interface ParsedPacket {
  result: CollectionResult;
  bytesRead: number;
  collectorId: number;
}

// Helper to parse one packet from buffer
const parseOnePacket = (data: Uint8Array, config: CollectionConfig): ParsedPacket | null => {
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

  const packetStart = data.slice(headerIndex);
  if (packetStart.length < 5) {
      return null;
  }

  const collectorId = packetStart[4];
  console.log("Found header. Collector ID:", collectorId);
  
  let packetLength = 0;
  const result: CollectionResult = {
    temperatureValues: {},
    humidityValues: null,
  };

  const { startIndex = 1, endIndex = 10, indoorThIndex = 11, outdoorThIndex = 12 } = config;

  // Determine type based on Config
  const isTemp = (collectorId >= startIndex && collectorId <= endIndex);
  const isIndoorTH = (collectorId === indoorThIndex);
  const isOutdoorTH = (collectorId === outdoorThIndex);

  if (isTemp) {
      // Temp packet: Fixed length 45 bytes
      if (packetStart.length < 45) {
          console.log(`Packet (Temp ID ${collectorId}) too short: ${packetStart.length}/45`);
          return null; 
      }
      
      packetLength = 45;

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
          
          result.temperatureValues[`${collectorId}-${cable}-${point}`] = parseFloat(tempValue.toFixed(2));
          tempIndex++;
        }
      }

  } else if (isIndoorTH || isOutdoorTH) {
      // TH packet: 9 bytes (Header 3 + Ext 1 + Col 1 + Temp 2 + Hum 2)
      if (packetStart.length < 9) {
          console.log(`Packet (TH ID ${collectorId}) too short: ${packetStart.length}/9`);
          return null;
      }
      
      packetLength = 9;

      // Temperature Parsing (Hex, Byte 5 is Int+Sign, Byte 6 is Dec)
      const tempIntRaw = packetStart[5];
      const tempDecRaw = packetStart[6];
      
      let tempInt = tempIntRaw;
      let isNegative = false;
      
      // Check for negative sign (0x80 bit)
      if (tempIntRaw >= 0x80) {
          tempInt = tempIntRaw - 0x80;
          isNegative = true;
      }
      
      // Calculate value: Int + Dec/100
      let tempValue = tempInt + (tempDecRaw / 100.0);
      if (isNegative) {
          tempValue = -tempValue;
      }
      // Format to 2 decimal places
      tempValue = parseFloat(tempValue.toFixed(2));
      
      // Humidity Parsing (Hex, Byte 7 is Int, Byte 8 is Dec)
      const humInt = packetStart[7];
      const humDec = packetStart[8];
      let humValue = humInt + (humDec / 100.0);
      humValue = parseFloat(humValue.toFixed(2));
  
      if (isIndoorTH) {
          result.temperatureValues["Indoor"] = { temperature: tempValue, humidity: humValue };
      } else {
          result.temperatureValues["Outdoor"] = { temperature: tempValue, humidity: humValue };
      }
  } else {
       // Unknown collector ID or not in config range
       console.log(`Unknown Collector ID ${collectorId} (Not in Temp ${startIndex}-${endIndex}, IndoorTH ${indoorThIndex}, OutdoorTH ${outdoorThIndex}). Skipping.`);
       // If we don't know the length, we can't safely skip it. 
       // But if we return null, we get stuck if this is indeed a packet.
       // We should assume it's garbage or try to skip header?
       // If we skip headerIndex + 1, we re-scan.
       // Let's treat it as a skip by returning bytesRead = headerIndex + 1 (move past this header)
       // But we need to be careful not to consume valid data if this 2C was fake.
       // However, 2C 5A A5 is quite specific.
       // Let's just skip this header.
       return {
           result,
           bytesRead: headerIndex + 1,
           collectorId
       };
  }

  return {
      result,
      bytesRead: headerIndex + packetLength,
      collectorId
  };
};

export const collectFromSerial = async (config: CollectionConfig): Promise<CollectionResult> => {
  if (!("serial" in navigator)) {
    throw new Error("您的浏览器不支持串口通讯，请使用 Chrome 或 Edge 浏览器。");
  }

  const extensionNumber = config.extensionNumber || 1;
  const totalCollectorCount = config.totalCollectorCount || 1;

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
    
    const finalResult: CollectionResult = {
        temperatureValues: {},
        humidityValues: null
    };
    const collectedIds = new Set<number>();
     
     const timeoutDuration = Math.max(5000, (totalCollectorCount + 5) * 1000);
     console.log(`Starting collection with timeout: ${timeoutDuration}ms for ${totalCollectorCount} collectors`);

     try {
          while (Date.now() - startTime < timeoutDuration) { 
              const readTimeout = new Promise<{ value: undefined, done: boolean } | undefined>((resolve) => 
                  setTimeout(() => resolve(undefined), 2000) 
              );

              const result = await Promise.race([
                  reader.read(),
                  readTimeout
              ]);

              if (!result) {
                  continue;
              }

              const { value, done } = result;

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

                while (true) {
                    const parsed = parseOnePacket(accumulatedData, config);
                    if (!parsed) break; 

                    if (parsed.bytesRead > 0 && parsed.collectorId > 0) {
                        // Only process if we actually parsed a packet (not just skipped header)
                        // If we skipped (bytesRead > 0 but result empty?), parseOnePacket returns result object anyway.
                        // We check if we added keys.
                        
                        const hasData = Object.keys(parsed.result.temperatureValues).length > 0;
                        
                        if (hasData) {
                            console.log(`Parsed packet from Collector ${parsed.collectorId}`);
                            Object.assign(finalResult.temperatureValues, parsed.result.temperatureValues);
                            collectedIds.add(parsed.collectorId);
                            console.log(`Progress: ${collectedIds.size}/${totalCollectorCount} collectors`);
                        }
                    }

                    accumulatedData = accumulatedData.slice(parsed.bytesRead);
                }

                if (collectedIds.size >= totalCollectorCount) {
                    console.log(`Collected ${collectedIds.size}/${totalCollectorCount} packets. Done.`);
                    return finalResult;
                }
            }
        }
        console.log(`Timeout reached. Collected: ${collectedIds.size}/${totalCollectorCount}. Returning partial data.`);
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
