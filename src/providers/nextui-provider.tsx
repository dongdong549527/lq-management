"use client";

import { HeroUIProvider } from "@heroui/react";

export function NextUIProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      {children}
    </HeroUIProvider>
  );
}
