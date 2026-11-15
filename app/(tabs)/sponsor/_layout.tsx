import { useQuery } from "convex/react";
import { Stack, router } from "expo-router";

import { SponsorErrorBoundary, Loading, SponsorScreen } from "@/components/sponsor/ui";
import { Button, EmptyState } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { colors } from "@/lib/theme";

function SponsorGate() {
  const me = useQuery(api.profiles.me, {});
  if (me === undefined) {
    return (
      <SponsorScreen title="Studio" back="/">
        <Loading />
      </SponsorScreen>
    );
  }
  if (!me?.isSponsor) {
    return (
      <SponsorScreen title="Studio" back="/">
        <EmptyState
          icon="megaphone"
          title="Sponsor"
          accent="studio"
          body={me ? "This account isn’t a sponsor member." : "Sign in with a sponsor account."}
          action={me ? null : <Button label="Sign in" onPress={() => router.push("/sign-in")} style={{ alignSelf: "stretch" }} />}
        />
      </SponsorScreen>
    );
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

export default function SponsorLayout() {
  return (
    <SponsorErrorBoundary>
      <SponsorGate />
    </SponsorErrorBoundary>
  );
}
