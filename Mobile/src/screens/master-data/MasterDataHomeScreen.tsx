import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { visibleMasters } from "@/hooks/use-master-data";
import { MASTER_GROUP_LABELS, MASTER_GROUP_ORDER } from "@/lib/master-data";
import { EmptyState, MenuCard } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { MasterDataStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<MasterDataStackParamList, "MasterHome">;

export default function MasterDataHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const masters = visibleMasters();

  if (masters.length === 0) {
    return <EmptyState icon="database" title="Nothing to manage" subtitle="Your account doesn't have access to any master data lists." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {MASTER_GROUP_ORDER.map((g) => {
        const inGroup = masters.filter((m) => m.group === g);
        if (inGroup.length === 0) return null;
        return (
          <View key={g} style={styles.group}>
            <Text style={styles.groupTitle}>{MASTER_GROUP_LABELS[g]}</Text>
            {inGroup.map((m) => (
              <MenuCard
                key={m.id}
                icon={m.icon}
                title={m.label}
                subtitle={m.description}
                onPress={() => navigation.navigate("MasterList", { masterId: m.id, title: m.label })}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.xl },
    group: { gap: spacing.sm },
    groupTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 },
  });
}
