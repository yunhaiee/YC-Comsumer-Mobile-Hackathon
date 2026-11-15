import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";

export default function FoundationScreen() {
  const hasDeployment = Boolean(process.env.EXPO_PUBLIC_CONVEX_URL);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.mark}>
          <Text style={styles.markText}>D</Text>
        </View>
        <Text style={styles.eyebrow}>COMPANY-SPONSORED CHALLENGES</Text>
        <Text style={styles.title}>DARE</Text>
        <Text style={styles.tagline}>Brands set the challenge. You make it happen.</Text>
        <View style={styles.status}>
          <Text style={styles.statusTitle}>Foundation ready</Text>
          <Text style={styles.body}>Expo Router · TypeScript · Convex-ready</Text>
          <Text style={styles.body}>
            {hasDeployment
              ? "Backend URL configured. Authentication and campaign APIs are next."
              : "Backend setup pending. Add EXPO_PUBLIC_CONVEX_URL after creating the team's Convex deployment."}
          </Text>
        </View>
        <Text style={styles.note}>
          This is the shared app foundation, not a live campaign. Predictions will use free play credits only.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    justifyContent: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 560,
    padding: 28,
    gap: 20,
  },
  mark: {
    width: 64,
    height: 64,
    backgroundColor: colors.accent,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: colors.text, fontSize: 40, fontWeight: "900" },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.text, fontSize: 72, fontWeight: "900", letterSpacing: -3 },
  tagline: { color: colors.text, fontSize: 25, fontWeight: "600", lineHeight: 33 },
  status: {
    padding: 20,
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
  },
  statusTitle: { color: colors.positive, fontSize: 16, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 19 },
});
