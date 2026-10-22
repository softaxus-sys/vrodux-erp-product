import { Image } from "react-native";
import { useAppTheme } from "@/theme";

/**
 * The real Vrodux brand artwork (the same file the web app uses, FrontendVite/public/vrodux-logo.png),
 * not a re-drawn approximation.
 *   - "mark"    the V and pixel squares only -- compact places (header, lists)
 *   - "lockup"  the full "Vrodux ERP Solution" logo -- sign-in screen
 * The lockup's lettering is navy, which disappears on a dark background, so dark mode gets a
 * white-lettered copy (the V keeps its blues).
 */
const MARK = require("../../../assets/logo-mark.png");
const LOCKUP = require("../../../assets/logo.png");
const LOCKUP_WHITE = require("../../../assets/logo-white.png");

const MARK_ASPECT = 979 / 792;
const LOCKUP_ASPECT = 2794 / 801;

export function BrandMark({ size = 56, variant = "mark" }: { size?: number; variant?: "mark" | "lockup" }) {
  const { isDark } = useAppTheme();
  if (variant === "lockup") {
    return (
      <Image
        source={isDark ? LOCKUP_WHITE : LOCKUP}
        style={{ width: size * LOCKUP_ASPECT, height: size }}
        resizeMode="contain"
        accessibilityLabel="Vrodux ERP Solution"
      />
    );
  }
  return (
    <Image
      source={MARK}
      style={{ width: size * MARK_ASPECT, height: size }}
      resizeMode="contain"
      accessibilityLabel="Vrodux"
    />
  );
}
