import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import type { PropsWithChildren } from "react";
import { Platform } from "react-native";

import { CenterMessage } from "@/components/ui";
import { api } from "@/convex/_generated/api";

const deploymentUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const client = deploymentUrl ? new ConvexReactClient(deploymentUrl) : null;

const secureStorage: TokenStorage | undefined =
  Platform.OS === "web"
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };

export function AppProviders({ children }: PropsWithChildren) {
  if (!client) {
    return (
      <CenterMessage
        title="Backend not configured"
        body="Set EXPO_PUBLIC_CONVEX_URL to the team's Convex deployment URL in .env.local, then restart Expo."
      />
    );
  }

  return (
    <ConvexAuthProvider
      client={client}
      storage={secureStorage}
      ambientSignIns={[]}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
        isAuthenticated: api.auth.isAuthenticated,
      }}
    >
      {children}
    </ConvexAuthProvider>
  );
}
