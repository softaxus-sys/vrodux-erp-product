import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { MenuCard } from "@/components/ui";
import { fontSize, spacing, useAppTheme, type AppColors } from "@/theme";
import { getTabLayout } from "@/navigation/tab-config";
import type { AppTabParamList } from "@/navigation/types";

type Props = BottomTabScreenProps<AppTabParamList, "More">;

/**
 * Houses whatever module tabs didn't fit directly in the bar (see `tab-config.ts`'s
 * `MAX_DIRECT_MODULE_TABS`) -- tapping a card navigates to that tab by name, same as tapping its
 * (unshown) tab-bar button would have. There's no explicit "back to More" affordance on the
 * screens reached from here because none is needed: the "More" tab itself is always in the bar,
 * and tapping it again shows this same menu (each destination is a sibling tab, not nested inside
 * this screen's own stack, so switching away and back doesn't lose or re-navigate anything).
 */
export default function MoreScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { overflow } = getTabLayout();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hint}>The rest of what you have access to.</Text>
      <View style={styles.menu}>
        {overflow.map((tab) => (
          <MenuCard
            key={tab.key}
            icon={tab.icon}
            title={tab.label}
            subtitle={tab.subtitle}
            onPress={() => navigation.navigate(tab.key)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    hint: { fontSize: fontSize.base, color: colors.mutedForeground },
    menu: { gap: spacing.sm + 2 },
  });
}
