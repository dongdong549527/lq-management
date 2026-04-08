import { NextResponse } from 'next/server';
import { mqttConfig } from '@/lib/config';

export async function GET() {
  return NextResponse.json({
    env: {
      MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
      MQTT_USERNAME: process.env.MQTT_USERNAME,
      MQTT_PASSWORD: process.env.MQTT_PASSWORD
    },
    config: mqttConfig
  });
}
