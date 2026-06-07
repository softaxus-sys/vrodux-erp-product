import type { Metadata } from "next";
import { PipelineView } from "@/modules/crm/pipeline/components/pipeline-view";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return <PipelineView />;
}
