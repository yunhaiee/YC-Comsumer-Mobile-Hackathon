import { useQuery } from "convex/react";
import { Stack } from "expo-router";

import { SponsorErrorBoundary, Loading, Notice, SponsorScreen } from "@/components/sponsor/ui";
import { api } from "@/convex/_generated/api";
import { colors } from "@/lib/theme";

function SponsorGate() {
  const me = useQuery(api.profiles.me, {});
  if (me === undefined) {
    return (
      <SponsorScreen title="Sponsor studio" back="/">
        <Loading />
      </SponsorScreen>
    );
  }
  if (!me?.isSponsor) {
    return (
      <SponsorScreen title="Sponsor access required" back="/">
        <Notice>
          {me ? "This account is not a sponsor member. Sign in with an authorized sponsor account to create and review campaigns." : "Sign in with an authorized sponsor account to open the sponsor studio."}
        </Notice>
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
