import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchVideoGuides, type VideoGuide } from "@/lib/support/video-guides.api";

const HOUR = 60 * 60 * 1000;

/** Every guide in the manifest (English for now; a per-language manifest is picked up automatically later). */
export function useVideoGuides() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  return useQuery<VideoGuide[]>({
    queryKey: ["video-guides", language],
    queryFn: () => fetchVideoGuides(language),
    staleTime: HOUR,
    gcTime: 2 * HOUR,
    retry: 1,
  });
}

/** One guide by slug, or null while loading / when the manifest has no such guide. */
export function useVideoGuide(slug: string | undefined) {
  const { data } = useVideoGuides();
  return slug ? data?.find((g) => g.slug === slug) ?? null : null;
}
