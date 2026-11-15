import { useSignInWithUsernamePassword, useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, ErrorText } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { colors, radius } from "@/lib/theme";

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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === "signIn" ? "Welcome back" : "Create your account"}</Text>
        <Text style={styles.body}>Take sponsored dares or predict outcomes with free play credits. No real money is wagered.</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            editable={!pending}
            style={styles.input}
            placeholderTextColor={colors.muted}
            placeholder="yourname"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            textContentType={mode === "signIn" ? "password" : "newPassword"}
            editable={!pending}
            style={styles.input}
            onSubmitEditing={submit}
          />
        </View>
        <ErrorText message={error} />
        <Button label={mode === "signIn" ? "Sign in" : "Create account"} onPress={submit} loading={pending} disabled={!username || !password} />
        <Button
          label={mode === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}
          variant="secondary"
          disabled={pending}
          onPress={() => {
            setError(null);
            setMode(mode === "signIn" ? "signUp" : "signIn");
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  field: { gap: 8 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
  },
});
