import type { Metadata } from "next";
import { IngredientsView } from "@/modules/recipe/components/ingredients-view";

export const metadata: Metadata = { title: "Ingredients" };

export default function IngredientsPage() {
  return <IngredientsView />;
}
