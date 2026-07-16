import { getSessionUserFromDb } from "@/lib/auth";
import { AppShell } from "./AppShell";

export async function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserFromDb();
  return <AppShell user={user}>{children}</AppShell>;
}
