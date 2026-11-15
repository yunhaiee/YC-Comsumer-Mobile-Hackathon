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
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "800" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: "", presentation: "modal" }} />
          <Stack.Screen name="dare/[id]/index" options={{ title: "Dare" }} />
          <Stack.Screen name="dare/[id]/submit" options={{ title: "Submit evidence" }} />
          <Stack.Screen name="profile" options={{ title: "Wallet & profile" }} />
        </Stack>
      </AppProviders>
    </SafeAreaProvider>
  );
}
