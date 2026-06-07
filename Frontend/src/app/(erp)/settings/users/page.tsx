import type { Metadata } from "next";
import { UsersView } from "@/modules/settings/users/components/users-view";
export const metadata: Metadata = { title: "Users & Roles" };
export default function UsersPage() { return <UsersView />; }
