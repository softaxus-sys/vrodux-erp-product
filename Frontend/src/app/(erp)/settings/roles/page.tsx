import type { Metadata } from "next";
import { RolesPermissionsView } from "@/modules/settings/roles/components/roles-permissions-view";
export const metadata: Metadata = { title: "Roles & Permissions" };
export default function RolesPage() { return <RolesPermissionsView />; }
