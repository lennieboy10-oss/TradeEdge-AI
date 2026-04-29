"use client";

import { UserPlanProvider } from "./lib/plan-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <UserPlanProvider>{children}</UserPlanProvider>;
}
