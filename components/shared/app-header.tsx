import { TopAppBar } from "./top-app-bar";

export function AppHeader({ userEmail }: { userEmail?: string | null }) {
  return <TopAppBar userEmail={userEmail} />;
}
