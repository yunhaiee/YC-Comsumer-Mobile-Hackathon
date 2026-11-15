import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { PropsWithChildren } from "react";

const deploymentUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const client = deploymentUrl ? new ConvexReactClient(deploymentUrl) : null;

export function AppProviders({ children }: PropsWithChildren) {
  if (!client) return children;

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
