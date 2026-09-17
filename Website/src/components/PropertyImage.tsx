import type { Property } from "@/lib/types";

/**
 * Listings arrive before the photographer does. Rather than a broken <img> or a grey
 * box, an unphotographed listing gets a deterministic branded panel keyed off its
 * reference, so the grid still reads as a designed page during handover.
 */
export function PropertyImage({
  property,
  className = "",
  priority = false,
  alt,
}: {
  property: Property;
  className?: string;
  priority?: boolean;
  alt: string;
}) {
  const src = property.images[0];

  if (src) {
    return (
      // Plain <img>: photos are served from /public or the client's CDN, and
      // next/image's optimiser adds a dependency on a running Node server that the
      // static export path would not have.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const seed = property.reference.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const angle = seed % 360;

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative h-full w-full overflow-hidden bg-ink-800 ${className}`}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, #2b2a27 0%, #44423e 45%, #8a5a39 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(45deg,#fff_0_1px,transparent_1px_14px)]" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <span className="font-display text-sm tracking-widest text-sand-200/70">
          {property.reference}
        </span>
      </div>
    </div>
  );
}
