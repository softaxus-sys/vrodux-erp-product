import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Chip, LoadingState, MenuCard } from "@/components/ui";
import { useCurrentBranch } from "@/hooks/use-branches";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

/**
 * A restaurant till always works at one branch. When the workspace has branches and none is chosen
 * this asks which one before showing the screen, so a shift, order, table or kitchen ticket is never
 * created without a branch (the server refuses it). A workspace with no branches -- or exactly one --
 * passes straight through.
 */
export function BranchGate({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { branchId, options, loading, setBranchId } = useCurrentBranch();

  if (loading) return <LoadingState />;
  if (options.length === 0 || branchId) return <>{children}</>;

  return (
    <ScrollView contentContainerStyle={styles.chooser}>
      <Text style={styles.title}>Which branch are you working at?</Text>
      <Text style={styles.body}>Orders, tables and the kitchen follow the branch you pick. You can change it later.</Text>
      {options.map((b) => (
        <MenuCard key={b.id} icon="map-pin" title={b.name} subtitle={[b.code, b.city].filter(Boolean).join(" · ")} tint={colors.primary} onPress={() => setBranchId(b.id)} />
      ))}
    </ScrollView>
  );
}

/** A one-line "Branch: X" switcher. Renders nothing when there is nothing to switch between. */
export function BranchSwitcher() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { branchId, options, setBranchId } = useCurrentBranch();
  if (options.length < 2) return null;
  return (
    <View style={styles.switcher}>
      <Text style={styles.label}>Branch</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((b) => (
          <Chip key={b.id} label={b.name} active={b.id === branchId} onPress={() => setBranchId(b.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    chooser: { padding: spacing.lg, gap: spacing.md },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    body: { fontSize: fontSize.sm, color: colors.mutedForeground },
    switcher: { gap: spacing.xs },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },
    chips: { gap: spacing.sm },
  });
}
