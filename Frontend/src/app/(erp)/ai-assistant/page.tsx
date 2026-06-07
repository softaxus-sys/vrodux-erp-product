import type { Metadata } from "next";
import { AIAssistantView } from "@/modules/ai-assistant/components/ai-assistant-view";
export const metadata: Metadata = { title: "AI Assistant" };
export default function AiAssistantPage() { return <AIAssistantView />; }
