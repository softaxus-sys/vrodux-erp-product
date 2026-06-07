import type { Metadata } from "next";
import { FileManagerView } from "@/modules/file-manager/components/file-manager-view";
export const metadata: Metadata = { title: "File Manager" };
export default function FileManagerPage() { return <FileManagerView />; }
