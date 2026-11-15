import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_CLEARANCE, colors, font, hairline, radius, space } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
type Tone = "accent" | "positive" | "warning" | "muted" | "negative";

const toneColor: Record<Tone, string> = {
  accent: colors.accentText,
  positive: colors.positive,
  warning: colors.warning,
  muted: colors.muted,
  negative: colors.negative,
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "yes" | "no";
  icon?: IconName;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = "primary", icon, selected, disabled, loading, style }: ButtonProps) {
  const inactive = disabled || loading;
  const labelColor = variant === "yes" && selected ? colors.positive : variant === "no" && selected ? colors.negative : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading, selected }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        selected && (variant === "yes" ? styles.yesSelected : variant === "no" ? styles.noSelected : styles.selected),
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={19} color={labelColor} /> : null}
          <Text style={[styles.buttonLabel, { color: labelColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, size = 44 }: { icon: IconName; label: string; onPress: () => void; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { width: size, height: size }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={colors.text} />
    </Pressable>
  );
}

export function Screen({
  children,
  title,
  accent,
  right,
  back,
  tabBar = true,
  contentStyle,
  ...scrollProps
}: PropsWithChildren<
  {
    title?: string;
    accent?: string;
    right?: ReactNode;
    back?: boolean;
    tabBar?: boolean;
    contentStyle?: StyleProp<ViewStyle>;
  } & Omit<ScrollViewProps, "contentContainerStyle">
>) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        { paddingTop: insets.top + 8, paddingBottom: (tabBar ? TAB_BAR_CLEARANCE : 32) + insets.bottom },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {back || title || right ? (
        <View style={styles.header}>
          {back ? <BackButton /> : null}
          {title ? (
            <Text accessibilityRole="header" style={styles.largeTitle} numberOfLines={2}>
              {title}
              {accent ? <Text style={{ color: colors.accent }}> {accent}</Text> : null}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {right ? <View style={styles.headerRight}>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function BackButton() {
  return (
    <IconButton
      icon="chevron-back"
      label="Go back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    />
  );
}

export function NavHeader({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <View style={styles.navHeader}>
      <BackButton />
      <Text style={styles.navTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.navSide}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = "muted", icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const color = toneColor[tone];
  return (
    <View style={[styles.pill, tone === "accent" && { backgroundColor: colors.accentSoft }]}>
      {icon ? <Ionicons name={icon} size={13} color={color} /> : tone !== "muted" ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.pillText, { color: tone === "muted" ? colors.text : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, !selected && { color: colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, right, onPress }: { children: ReactNode; right?: ReactNode; onPress?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Pressable disabled={!onPress} onPress={onPress} style={styles.sectionTitleWrap}>
        <Text style={styles.sectionTitle}>{children}</Text>
        {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.text} /> : null}
      </Pressable>
      {right}
    </View>
  );
}

export function Row({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, tone && { color: toneColor[tone] }]}>{value}</Text>
    </View>
  );
}

export function Avatar({ label, size = 44, tone }: { label: string; size?: number; tone?: "accent" }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        tone === "accent" && { backgroundColor: colors.accentSoft, borderColor: "rgba(139,92,246,0.35)" },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }, tone === "accent" && { color: colors.accentText }]}>
        {label.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  valueSub?: string;
  tone?: Tone;
  icon?: IconName;
  iconTone?: Tone;
  avatar?: string;
  destructive?: boolean;
  onPress?: () => void;
  first?: boolean;
};

export function ListRow({ title, subtitle, value, valueSub, tone, icon, iconTone, avatar, destructive, onPress, first }: ListRowProps) {
  const iconColor = destructive ? colors.negative : iconTone ? toneColor[iconTone] : colors.text;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
    >
      {avatar ? <Avatar label={avatar} /> : null}
      {icon ? (
        <View style={[styles.listIcon, iconTone && { backgroundColor: iconTone === "positive" ? colors.positiveSoft : iconTone === "negative" ? colors.negativeSoft : colors.accentSoft }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      ) : null}
      <View style={[styles.listBody, !first && styles.listDivider]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.listTitle, destructive && { color: colors.negative }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.listSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? (
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={[styles.listValue, tone && { color: toneColor[tone] }]}>{value}</Text>
            {valueSub ? <Text style={styles.listSubtitle}>{valueSub}</Text> : null}
          </View>
        ) : null}
        {onPress && !destructive ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
      </View>
    </Pressable>
  );
}

export function BalanceHero({ label, value, caption, right }: { label: string; value: string; caption?: string; right?: ReactNode }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroLabel}>{label}</Text>
      <View style={styles.heroRow}>
        <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </Text>
        {right}
      </View>
      {caption ? <Text style={styles.heroCaption}>{caption}</Text> : null}
    </View>
  );
}

export function ActionTiles({ tiles }: { tiles: { icon: IconName; label: string; onPress: () => void }[] }) {
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <Pressable
          key={tile.label}
          accessibilityRole="button"
          onPress={tile.onPress}
          style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
        >
          <Ionicons name={tile.icon} size={24} color={colors.text} />
          <Text style={styles.tileLabel} numberOfLines={1}>
            {tile.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function IsoArt({ icon, size = 120 }: { icon: IconName; size?: number }) {
  const tile = size * 0.62;
  const diamond = (offset: number, color: string, scale = 1) => ({
    position: "absolute" as const,
    width: tile * scale,
    height: tile * scale,
    borderRadius: tile * 0.16 * scale,
    backgroundColor: color,
    top: size * 0.5 - (tile * scale) / 2 + offset,
    left: size / 2 - (tile * scale) / 2,
    transform: [{ scaleY: 0.58 }, { rotate: "45deg" }],
  });
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[14, 12, 10, 8, 6, 4, 2].map((o) => (
        <View key={o} style={diamond(o + size * 0.08, "#232326")} />
      ))}
      <View style={diamond(size * 0.08, "#3A3A3E")} />
      {[6, 4, 2].map((o) => (
        <View key={`a${o}`} style={diamond(o - size * 0.06, "#5B3BC4", 0.55)} />
      ))}
      <View style={diamond(-size * 0.06, colors.accent, 0.55)} />
      <View style={{ position: "absolute", left: 0, right: 0, top: size * 0.06, alignItems: "center" }}>
        <View style={styles.isoBadge}>
          <Ionicons name={icon} size={size * 0.24} color={colors.text} />
        </View>
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  accent,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  accent?: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <IsoArt icon={icon} />
      <Text style={styles.emptyTitle}>
        {title}
        {accent ? <Text style={{ color: colors.accent }}> {accent}</Text> : null}
      </Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action ? <View style={{ marginTop: 8, alignSelf: "stretch", alignItems: "center" }}>{action}</View> : null}
    </View>
  );
}

export function CenterMessage({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.muted} />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

export const text = StyleSheet.create({
  body: { color: colors.muted, ...font.callout, lineHeight: 21 },
  small: { color: colors.muted, ...font.footnote, lineHeight: 18 },
  strong: { color: colors.text, ...font.headline },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { paddingHorizontal: space.screen, gap: 20, maxWidth: 680, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  headerRight: { flexDirection: "row", gap: 10 },
  largeTitle: { flex: 1, color: colors.text, ...font.largeTitle },
  navHeader: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  navTitle: { flex: 1, textAlign: "center", color: colors.text, ...font.headline },
  navSide: { width: 44, alignItems: "flex-end" },
  button: { minHeight: 54, paddingHorizontal: 20, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceRaised },
  yes: { backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: "transparent" },
  no: { backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: "transparent" },
  yesSelected: { backgroundColor: colors.positiveSoft, borderColor: colors.positive },
  noSelected: { backgroundColor: colors.negativeSoft, borderColor: colors.negative },
  selected: { borderWidth: 1.5, borderColor: colors.text },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  buttonLabel: { color: colors.text, ...font.headline, textAlign: "center" },
  iconButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: hairline,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: hairline, borderRadius: radius.lg, padding: 16, gap: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 13, fontWeight: "600", letterSpacing: -0.1, flexShrink: 1 },
  chip: { borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, paddingVertical: 9 },
  chipSelected: { backgroundColor: colors.surfaceHigh, borderWidth: hairline, borderColor: "rgba(255,255,255,0.18)" },
  chipText: { color: colors.text, ...font.callout, fontWeight: "500" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { color: colors.text, ...font.title },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowLabel: { color: colors.muted, ...font.callout, flexShrink: 1 },
  rowValue: { color: colors.text, ...font.callout, fontWeight: "600", textAlign: "right" },
  avatar: {
    backgroundColor: "#3A3D45",
    borderWidth: hairline,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.text, fontWeight: "500" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60 },
  listIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  listBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch", paddingVertical: 12 },
  listDivider: { borderTopWidth: hairline, borderTopColor: colors.hairline },
  listTitle: { color: colors.text, ...font.body },
  listSubtitle: { color: colors.muted, ...font.footnote },
  listValue: { color: colors.text, ...font.body, fontWeight: "500" },
  hero: { gap: 2 },
  heroLabel: { color: colors.text, ...font.callout, fontWeight: "500" },
  heroRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  heroValue: { color: colors.text, fontSize: 48, fontWeight: "700", letterSpacing: -1.2, flexShrink: 1 },
  heroCaption: { color: colors.muted, ...font.callout },
  tiles: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tilePressed: { backgroundColor: colors.surface },
  tileLabel: { color: colors.text, fontSize: 15, fontWeight: "500", letterSpacing: -0.2 },
  isoBadge: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 12 },
  emptyTitle: { color: colors.text, ...font.title, textAlign: "center", marginTop: 8 },
  emptyBody: { color: colors.muted, ...font.callout, lineHeight: 21, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: colors.background },
  error: { color: colors.negative, ...font.footnote, lineHeight: 18 },
});
