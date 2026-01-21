"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { NextUIProviderWrapper } from "@/providers/nextui-provider";
import { Toaster } from "sonner";

export function Providers({ children, session }: { children: ReactNode, session?: any }) {
  return (
    <SessionProvider session={session}>
      <NextUIProviderWrapper
        attribute="class"
        defaultTheme="light"
        themeProps={{
          attribute: "class",
          defaultTheme: "light",
        }}
      >
        {children}
        <Toaster richColors position="top-right" />
      </NextUIProviderWrapper>
    </SessionProvider>
  );
}
