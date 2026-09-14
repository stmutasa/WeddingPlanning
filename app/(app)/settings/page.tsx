import { SettingsScreen } from "@/components/settings/SettingsScreen";

const appName = process.env.APP_NAME ?? "Harusi";

export default function SettingsPage() {
  return <SettingsScreen appName={appName} />;
}
