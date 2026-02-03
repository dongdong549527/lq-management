"use server";

import mqtt from "mqtt";
import { CollectionConfig, CollectionResult, parseOnePacket } from "@/lib/collection";
import { collectionLock } from "@/lib/collection-lock";
import { prisma } from "@/lib/prisma";

export const collectFromMqttAction = async (
  config: CollectionConfig
): Promise<CollectionResult> => {
  // Use provided defaults if not specified in config
  const brokerUrl = config.mqttBrokerUrl || "mqtt://claw.540777.xyz:1883";
  const username = config.mqttUsername || "admin";
  const password = config.mqttPassword || "admin";

  // Lock Key based on Pub/Sub topics to identify the device channel
  const lockKey = `${config.mqttTopicPub}-${config.mqttTopicSub}`;

  if (!collectionLock.acquire(lockKey)) {
      throw new Error("该设备正在采集中，请稍后重试");
  }
  
  // Set status to Collecting (2)
  if (config.granaryId) {
    try {
        await prisma.granary.update({
            where: { id: config.granaryId },
            data: { collectionStatus: 2 } // 2: Collecting
        });
    } catch (e) {
        console.error("Failed to update status to collecting:", e);
    }
  }

  try {
    console.log(`[Server Action] Connecting to MQTT broker: ${brokerUrl}`);
    
    // ... logic ...
    const result = await new Promise<CollectionResult>((resolve, reject) => {
        if (!config.mqttTopicSub || !config.mqttTopicPub) {
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
            console.log(`[Server Action] MQTT Timeout reached. Returning partial data.`);
            resolve(finalResult);
        } else {
            reject(new Error("采集超时"));
        }
        }, timeoutDuration);

        client.on("connect", () => {
        console.log("[Server Action] MQTT Connected");
        client.subscribe(config.mqttTopicSub!, (err) => {
            if (err) {
            clearTimeout(timeout);
            client.end();
            reject(new Error("订阅主题失败"));
            } else {
            console.log(`[Server Action] Subscribed to ${config.mqttTopicSub}. Sending command...`);
            
            let command: string | Buffer;
            
            if (config.collectionDevice === 2 || config.collectionDevice === 3) {
                // Network Host / Extension: Send Binary Command
                const extensionNumber = config.extensionNumber || 1;
                const cmdBytes = new Uint8Array([0x05, 0x55, 0xAA, extensionNumber, 0xAA, 0x55]);
                command = Buffer.from(cmdBytes);
                console.log("[Server Action] Sending Binary Command:", Array.from(cmdBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
            } else {
                // Default / Legacy JSON command
                command = JSON.stringify({ action: "collect" });
                console.log("[Server Action] Sending JSON Command:", command);
            }
            
            client.publish(config.mqttTopicPub!, command);
            }
        });
        });

        client.on("message", (topic, message) => {
        if (topic === config.mqttTopicSub) {
            // message is Buffer
            console.log("[Server Action] MQTT Received chunk:", message.length, "bytes");
            
            // Convert Buffer to Uint8Array
            const value = new Uint8Array(message);
            const newData = new Uint8Array(accumulatedData.length + value.length);
            newData.set(accumulatedData);
            newData.set(value, accumulatedData.length);
            accumulatedData = newData;

            while (true) {
                const parsed = parseOnePacket(accumulatedData, config);
                if (!parsed) break; 

                if (parsed.bytesRead > 0 && parsed.collectorId > 0) {
                    const hasData = Object.keys(parsed.result.temperatureValues).length > 0;
                    
                    if (hasData) {
                        console.log(`[Server Action] MQTT Parsed packet from Collector ${parsed.collectorId}`);
                        Object.assign(finalResult.temperatureValues, parsed.result.temperatureValues);
                        collectedIds.add(parsed.collectorId);
                        console.log(`[Server Action] Progress: ${collectedIds.size}/${totalCollectorCount} collectors`);
                    }
                }

                accumulatedData = accumulatedData.slice(parsed.bytesRead);
            }

            if (collectedIds.size >= totalCollectorCount) {
                console.log(`[Server Action] MQTT Collected ${collectedIds.size}/${totalCollectorCount} packets. Done.`);
                clearTimeout(timeout);
                client.end();
                resolve(finalResult);
            }
        }
        });

        client.on("error", (err) => {
        console.error("[Server Action] MQTT Error:", err);
        clearTimeout(timeout);
        client.end();
        reject(new Error(`MQTT 错误: ${err.message}`));
        });
    });

    return result;

  } catch (error) {
    // If failed, reset status to 0 (or keep it as is? Better to reset so user can retry)
    // Or maybe we want a "Failed" status like 3?
    // For now, let's reset to 0 (Pending) if it was 2.
    if (config.granaryId) {
        try {
            await prisma.granary.update({
                where: { id: config.granaryId },
                data: { collectionStatus: 0 } 
            });
        } catch (e) { console.error("Failed to reset status:", e); }
    }
    throw error;
  } finally {
    // Always release the lock
    collectionLock.release(lockKey);
  }
};
