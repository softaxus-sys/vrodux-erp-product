import type { Metadata } from "next";
import { AccountingView } from "@/modules/finance/accounting/components/accounting-view";
export const metadata: Metadata = { title: "Chart of Accounts" };
export default function AccountingPage() { return <AccountingView />; }
