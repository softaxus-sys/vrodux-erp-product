import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fontSize, fontWeight, spacing, useAppTheme } from "@/theme";

/**
 * Puts a "+ New" (or any labelled) action in a stack screen's header, only when `enabled`.
 * `actions` lets a screen show more than one (e.g. New + Accounts).
 */
export interface HeaderAction {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  enabled?: boolean;
}

export function useHeaderActions(navigation: { setOptions: (o: object) => void }, actions: HeaderAction[]) {
  const { colors } = useAppTheme();
  const active = actions.filter((a) => a.enabled !== false);
  const signature = active.map((a) => a.label).join("|");
  useEffect(() => {
    navigation.setOptions({
      headerRight: active.length
        ? () => (
            <>
              {active.map((a) => (
                <Pressable key={a.label} onPress={a.onPress} hitSlop={8} style={styles.wrap}>
                  <Feather name={a.icon ?? "plus"} size={16} color={colors.primary} />
                  <Text style={[styles.text, { color: colors.primary }]}>{a.label}</Text>
                </Pressable>
              ))}
            </>
          )
        : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, signature, colors.primary]);
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm },
  text: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
