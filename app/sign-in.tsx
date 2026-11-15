import { useSignInWithUsernamePassword, useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ErrorText, IsoArt, NavHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { colors, font, radius, space } from "@/lib/theme";

type AuthError = { error: string; minimumLength?: number; maximumLength?: number };

function describeError(error: AuthError) {
  switch (error.error) {
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return "Username or password is incorrect.";
    case "USERNAME_TAKEN":
      return "That username is taken.";
    case "PASSWORD_TOO_SHORT":
      return `Password needs at least ${error.minimumLength} characters.`;
    case "PASSWORD_TOO_LONG":
      return `Password can be at most ${error.maximumLength} characters.`;
    case "PASSWORD_TOO_COMMON":
      return "That password is too common.";
    case "USERNAME_TOO_SHORT":
      return `Username needs at least ${error.minimumLength} characters.`;
    case "USERNAME_TOO_LONG":
      return `Username can be at most ${error.maximumLength} characters.`;
    case "USERNAME_HAS_INVALID_CHARACTERS":
      return "Username can only use letters, numbers, and simple punctuation.";
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Remove spaces at the start or end.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return "Couldn’t reach the server. Try again.";
  }
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const signIn = useSignInWithUsernamePassword(api.auth);
  const signUp = useSignUpWithUsernamePassword(api.auth);
  const pending = signIn.pending || signUp.pending;

  const submit = async () => {
    if (!username || !password || pending) return;
    setError(null);
    const result = mode === "signIn" ? await signIn.signIn({ username, password }) : await signUp.signUp({ username, password });
    if (result.status === "complete") {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    setError(describeError(result.userError));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <NavHeader title={mode === "signIn" ? "Sign in" : "Create account"} />
        <View style={styles.hero}>
          <IsoArt icon="flash" size={140} />
          <Text style={styles.title}>
            {mode === "signIn" ? "Welcome" : "Join the"} <Text style={{ color: colors.accent }}>{mode === "signIn" ? "back" : "dare"}</Text>
          </Text>
          <Text style={styles.body}>Sandbox USD · test payments only, no real money.</Text>
        </View>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          editable={!pending}
          style={styles.input}
          placeholderTextColor={colors.faint}
          placeholder="Username"
          accessibilityLabel="Username"
          selectionColor={colors.accent}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          textContentType={mode === "signIn" ? "password" : "newPassword"}
          editable={!pending}
          style={styles.input}
          placeholderTextColor={colors.faint}
          placeholder="Password"
          accessibilityLabel="Password"
          selectionColor={colors.accent}
          onSubmitEditing={submit}
        />
        <ErrorText message={error} />
        <Button label={mode === "signIn" ? "Sign in" : "Create account"} onPress={submit} loading={pending} disabled={!username || !password} />
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => {
            setError(null);
            setMode(mode === "signIn" ? "signUp" : "signIn");
          }}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {mode === "signIn" ? "New here? " : "Have an account? "}
            <Text style={styles.switchLink}>{mode === "signIn" ? "Create an account" : "Sign in"}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: space.screen, gap: 14, maxWidth: 480, width: "100%", alignSelf: "center" },
  hero: { alignItems: "center", gap: 6, paddingVertical: 24 },
  title: { color: colors.text, ...font.title, fontSize: 28, marginTop: 8 },
  body: { color: colors.muted, ...font.callout },
  input: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 18,
  },
  switch: { alignItems: "center", paddingVertical: 12 },
  switchText: { color: colors.muted, ...font.callout },
  switchLink: { color: colors.text, fontWeight: "600" },
});
