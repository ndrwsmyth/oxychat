"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import { ReactNode } from "react";
import { AuthTokenBridge } from "@/components/auth/AuthTokenBridge";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <AuthTokenBridge />
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            },
          }}
        />
      </NextThemesProvider>
    </ClerkProvider>
  );
}
