import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";
import { AppProviders } from "@/providers/AppProviders";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </AppProviders>
    </SafeAreaProvider>
  );
}
