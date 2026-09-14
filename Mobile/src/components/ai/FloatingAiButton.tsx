import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, shadowRaised, useAppTheme } from "@/theme";

/**
 * Persistent entry point to the assistant, rendered once at the root (see RootNavigator.tsx) so
 * it floats over every authenticated screen -- not a tab-bar item. The assistant is "always-on"
 * (see ai.api.ts's own note on this), and tabs are the scarce, permission-gated resource
 * (tab-config.ts caps the bar at 5) -- a persistent floating button avoids competing with those
 * for a slot, and matches how the web app surfaces it (a floating panel reachable from any page,
 * not just its own nav entry).
 */
export function FloatingAiButton({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Bottom offset clears the tab bar (~58px) plus the device's own safe-area inset.
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: colors.primary, bottom: 58 + insets.bottom + 12 },
        shadowRaised,
      ]}
      hitSlop={8}
    >
      <Feather name="message-circle" size={22} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 16,
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
