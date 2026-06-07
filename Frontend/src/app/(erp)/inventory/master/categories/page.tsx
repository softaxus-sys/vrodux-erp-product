import type { Metadata } from "next";
import { CategoriesMasterView } from "@/modules/inventory/master/components/categories-master-view";
export const metadata: Metadata = { title: "Item Categories" };
export default function CategoriesMasterPage() { return <CategoriesMasterView />; }
