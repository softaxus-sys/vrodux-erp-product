import type { Metadata } from "next";
import { GeneralSettingsView } from "@/modules/settings/general/components/general-settings-view";
export const metadata: Metadata = { title: "General Settings" };
export default function GeneralSettingsPage() { return <GeneralSettingsView />; }
