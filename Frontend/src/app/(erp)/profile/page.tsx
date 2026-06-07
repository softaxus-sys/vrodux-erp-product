import type { Metadata } from "next";
import { ProfileView } from "@/modules/profile/components/profile-view";
export const metadata: Metadata = { title: "My Profile" };
export default function ProfilePage() { return <ProfileView />; }
