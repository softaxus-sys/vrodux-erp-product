import { ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CRM_REPORT_DEFS } from "@/lib/crm-reports";
import { MenuCard } from "@/components/ui";
import { spacing } from "@/theme";
import type { LeadsStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadsStackParamList, "CrmReports">;

export default function CrmReportsScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {CRM_REPORT_DEFS.map((r) => (
        <MenuCard key={r.id} icon={r.icon} title={r.title} subtitle={r.description} onPress={() => navigation.navigate("CrmReport", { reportId: r.id, title: r.title })} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: spacing.lg, gap: spacing.sm } });
