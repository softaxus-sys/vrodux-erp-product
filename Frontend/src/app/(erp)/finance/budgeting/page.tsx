import type { Metadata } from "next";
import { BudgetingView } from "@/modules/finance/budgeting/components/budgeting-view";
export const metadata: Metadata = { title: "Budgeting" };
export default function BudgetingPage() { return <BudgetingView />; }
