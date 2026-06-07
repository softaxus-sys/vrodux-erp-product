import type { Metadata } from "next";
import { RecruitmentView } from "@/modules/hr/recruitment/components/recruitment-view";

export const metadata: Metadata = { title: "Recruitment" };

export default function RecruitmentPage() {
  return <RecruitmentView />;
}
