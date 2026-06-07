import type { Metadata } from "next";
import { ExpensesView } from "@/modules/finance/expenses/components/expenses-view";
export const metadata: Metadata = { title: "Expenses" };
export default function ExpensesPage() { return <ExpensesView />; }
