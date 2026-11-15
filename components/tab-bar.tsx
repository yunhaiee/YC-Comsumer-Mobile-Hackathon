import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IconName } from "@/components/ui";
import { colors, hairline } from "@/lib/theme";

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: "Home", icon: "home-outline", activeIcon: "home" },
  wallet: { label: "Wallet", icon: "wallet-outline", activeIcon: "wallet" },
  sponsor: { label: "Sponsor", icon: "megaphone-outline", activeIcon: "megaphone" },
  profile: { label: "Profile", icon: "person-circle-outline", activeIcon: "person-circle" },
};

export function FloatingTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 6, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const onPress = () => {
            if (!focused) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={onPress}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <Ionicons name={focused ? tab.activeIcon : tab.icon} size={24} color={focused ? colors.text : colors.muted} />
              <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    padding: 6,
    borderRadius: 36,
    backgroundColor: "rgba(32,32,34,0.97)",
    borderWidth: hairline,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 8, borderRadius: 30 },
  tabActive: { backgroundColor: "rgba(255,255,255,0.09)" },
  label: { color: colors.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.1 },
  labelActive: { color: colors.text },
});
