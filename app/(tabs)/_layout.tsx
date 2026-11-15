import { Tabs } from "expo-router/tabs";

import { FloatingTabBar } from "@/components/tab-bar";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="sponsor" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
