import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";
import { AppProviders } from "@/providers/AppProviders";

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <AppProviders>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
          <Stack.Screen name="dare/[id]/index" />
          <Stack.Screen name="dare/[id]/submit" />
        </Stack>
      </AppProviders>
    </SafeAreaProvider>
  );
}
