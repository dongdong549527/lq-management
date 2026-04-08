"use server";

// 日志工具函数
const log = (level: 'info' | 'error' | 'debug', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [SERVER ACTION] ${message}`;
  if (data) {
    console[level === 'error' ? 'error' : 'log'](logMessage, data);
  } else {
    console[level === 'error' ? 'error' : 'log'](logMessage);
  }
};

import mqtt from "mqtt";
import { CollectionConfig, CollectionResult, parseOnePacket } from "@/lib/collection";
import { collectionLock } from "@/lib/collection-lock";
import { prisma } from "@/lib/prisma";
import { mqttConfig } from "@/lib/config";

export const collectFromMqttAction = async (
  config: CollectionConfig
): Promise<CollectionResult> => {
  // Always use config from environment variables, ignore config from granary
  // This ensures MQTT server settings are centralized in .env file
  const brokerUrl = mqttConfig.brokerUrl;
  const username = mqttConfig.username;
  const password = mqttConfig.password;

  // Lock Key based on Pub/Sub topics to identify the device channel
  const lockKey = `${config.mqttTopicPub}-${config.mqttTopicSub}`;

  log('info', "开始服务器端 MQTT 采集动作");
  log('info', `仓房 ID: ${config.granaryId || 'N/A'}`);
  log('info', `采集设备类型: ${config.collectionDevice} (1: Serial, 2: Network Host, 3: Network Extension)`);
  log('info', `MQTT Broker: ${brokerUrl}`);
  log('info', `订阅主题: ${config.mqttTopicSub}`);
  log('info', `发布主题: ${config.mqttTopicPub}`);

  if (!collectionLock.acquire(lockKey)) {
      log('error', "采集锁获取失败，设备正在采集中");
      throw new Error("该设备正在采集中，请稍后重试");
  }
  log('info', "采集锁获取成功");
  
  // Set status to Collecting (2)
  if (config.granaryId) {
    try {
        await prisma.granary.update({
            where: { id: config.granaryId },
            data: { collectionStatus: 2 } // 2: Collecting
        });
        log('info', `更新仓房 ${config.granaryId} 状态为采集进行中`);
    } catch (e) {
        log('error', "更新仓房状态失败", e);
    }
  }

  try {
    log('info', `连接到 MQTT broker: ${brokerUrl}`);
    
    // ... logic ...
    const result = await new Promise<CollectionResult>((resolve, reject) => {
        if (!config.mqttTopicSub || !config.mqttTopicPub) {
        log('error', "未配置 MQTT 主题");
        reject(new Error("未配置 MQTT 主题"));
        return;
        }

        const client = mqtt.connect(brokerUrl, {
            clientId: `server_client_${Math.random().toString(16).substring(2, 8)}`,
            username,
            password,
            keepalive: 60,
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
        });

        const totalCollectorCount = config.totalCollectorCount || 1;
        // Timeout slightly longer than Serial because of network latency
        const timeoutDuration = Math.max(10000, (totalCollectorCount + 5) * 1000); 
        log('info', `采集超时时间: ${timeoutDuration}ms，目标采集器数量: ${totalCollectorCount}`);
        
        let accumulatedData = new Uint8Array();
        const finalResult: CollectionResult = {
            temperatureValues: {},
            humidityValues: null
        };
        const collectedIds = new Set<number>();

        const timeout = setTimeout(() => {
        client.end();
        // If we have some data, return it
        if (Object.keys(finalResult.temperatureValues).length > 0) {
            log('error', `MQTT 采集超时，返回部分数据`);
            resolve(finalResult);
        } else {
            log('error', "MQTT 采集超时且未收到有效数据");
            reject(new Error("采集超时"));
        }
        }, timeoutDuration);

        client.on("connect", () => {
        log('info', "MQTT 连接成功");
        client.subscribe(config.mqttTopicSub!, (err) => {
            if (err) {
            clearTimeout(timeout);
            client.end();
            log('error', "MQTT 订阅主题失败", err);
            reject(new Error("订阅主题失败"));
            } else {
            log('info', `已订阅主题: ${config.mqttTopicSub}`);
            
            let command: string | Buffer;
            
            if (config.collectionDevice === 2 || config.collectionDevice === 3) {
                // Network Host / Extension: Send Binary Command
                const extensionNumber = config.extensionNumber || 1;
                const cmdBytes = new Uint8Array([0x05, 0x55, 0xAA, extensionNumber, 0xAA, 0x55]);
                command = Buffer.from(cmdBytes);
                const commandHex = Array.from(cmdBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
                log('info', `发送二进制命令: ${commandHex}`);
            } else {
                // Default / Legacy JSON command
                command = JSON.stringify({ action: "collect" });
                log('info', `发送 JSON 命令: ${command}`);
            }
            
            client.publish(config.mqttTopicPub!, command);
            log('info', `命令已发送到主题: ${config.mqttTopicPub}`);
            }
        });
        });

        client.on("message", (topic, message) => {
        if (topic === config.mqttTopicSub) {
            // message is Buffer
            log('info', `收到 MQTT 消息: ${message.length} bytes`);
            
            // Convert Buffer to Uint8Array
            const value = new Uint8Array(message);
            const newData = new Uint8Array(accumulatedData.length + value.length);
            newData.set(accumulatedData);
            newData.set(value, accumulatedData.length);
            accumulatedData = newData;
            log('info', `累计数据: ${accumulatedData.length} bytes`);

            while (true) {
                const parsed = parseOnePacket(accumulatedData, config);
                if (!parsed) break; 

                if (parsed.bytesRead > 0 && parsed.collectorId > 0) {
                    const hasData = Object.keys(parsed.result.temperatureValues).length > 0;
                    
                    if (hasData) {
                        log('info', `解析到采集器 ${parsed.collectorId} 的数据包`);
                        Object.assign(finalResult.temperatureValues, parsed.result.temperatureValues);
                        collectedIds.add(parsed.collectorId);
                        log('info', `采集进度: ${collectedIds.size}/${totalCollectorCount} 个采集器`);
                    }
                }

                accumulatedData = accumulatedData.slice(parsed.bytesRead);
            }

            if (collectedIds.size >= totalCollectorCount) {
                log('info', `采集完成: 已收到 ${collectedIds.size}/${totalCollectorCount} 个采集器的数据`);
                clearTimeout(timeout);
                client.end();
                resolve(finalResult);
            }
        }
        });

        client.on("error", (err) => {
        log('error', "MQTT 连接错误", err);
        clearTimeout(timeout);
        client.end();
        reject(new Error(`MQTT 错误: ${err.message}`));
        });
        
        client.on("close", () => {
        log('info', "MQTT 连接已关闭");
        });
        
        client.on("reconnect", () => {
        log('info', "MQTT 正在重连...");
        });
    });

    // Update status to Success (1) and set last collected time
    if (config.granaryId) {
        try {
            await prisma.granary.update({
                where: { id: config.granaryId },
                data: {
                    collectionStatus: 1, // 1: Success
                    lastCollectedAt: new Date()
                }
            });
            log('info', `更新仓房 ${config.granaryId} 状态为采集成功`);
        } catch (e) {
            log('error', "更新仓房状态失败", e);
        }
    }
    
    log('info', `采集成功，返回 ${Object.keys(result.temperatureValues).length} 个数据点`);
    return result;

  } catch (error: any) {
    log('error', "采集错误", error);
    // If failed, reset status to 0 (or keep it as is? Better to reset so user can retry)
    // Or maybe we want a "Failed" status like 3?
    // For now, let's reset to 0 (Pending) if it was 2.
    if (config.granaryId) {
        try {
            await prisma.granary.update({
                where: { id: config.granaryId },
                data: { collectionStatus: 0 } 
            });
            log('info', `更新仓房 ${config.granaryId} 状态为待采集`);
        } catch (e) { 
            log('error', "重置仓房状态失败", e);
        }
    }
    throw error;
  } finally {
    // Always release the lock
    collectionLock.release(lockKey);
    log('info', "释放采集锁");
  }
};
