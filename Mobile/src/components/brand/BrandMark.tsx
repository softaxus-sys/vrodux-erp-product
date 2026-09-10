import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * The "V" tile -- mirrors FrontendVite/public/favicon.svg exactly (same #2563eb -> #1e3a8a
 * gradient, same rounded-square tile, same white mark) so the mobile app opens on the same
 * brand mark a user already recognizes from the browser tab / PWA icon. Drawn with a bold "V"
 * glyph rather than an SVG path -- react-native-svg is a dependency neither this app nor its
 * Expo Go testing setup currently needs elsewhere, and a heavy round glyph reads identically at
 * the sizes this renders at (48-96px).
 */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <LinearGradient
      colors={["#2563EB", "#1E3A8A"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.22 }]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.52 }]}>V</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center" },
  glyph: { color: "#FFFFFF", fontWeight: "800", includeFontPadding: false },
});
