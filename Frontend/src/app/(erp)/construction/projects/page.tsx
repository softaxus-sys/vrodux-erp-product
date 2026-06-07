import type { Metadata } from "next";
import { ProjectsView } from "@/modules/construction/projects/components/projects-view";
export const metadata: Metadata = { title: "Projects" };
export default function ProjectsPage() { return <ProjectsView />; }
