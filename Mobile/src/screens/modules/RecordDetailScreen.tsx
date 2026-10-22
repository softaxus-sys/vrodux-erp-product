import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LIST_BY_KEY } from "@/lib/module-browser";
import { NextStepBar } from "@/components/verticals/VerticalActions";
import { Badge, DetailRow, SectionCard } from "@/components/ui";
import { titleCaseStatus } from "@/lib/verticals-shared";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { ExtraStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ExtraStackParamList, "RecordDetail">;

const HIDDEN = /(^id$|Id$|Utc$|^attachments$|dataUri)/;

function label(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function show(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 16).replace("T", " ");
  return String(v);
}

/** Every plain field on the record, readable. The row's own actions sit on top. */
export default function RecordDetailScreen({ route, navigation }: Props) {
  const { listKey, record } = route.params;
  const { list } = LIST_BY_KEY[listKey];
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const v = list.row(record);
  const status = list.status ? list.status(record) : String(record.status ?? "");

  useEffect(() => navigation.setOptions({ headerTitle: v.title.split(" · ")[0] }), [navigation, v.title]);

  const fields = Object.entries(record).filter(([k, val]) => !HIDDEN.test(k) && val !== null && val !== "" && typeof val !== "object");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{v.title}</Text>
        {v.subtitle ? <Text style={styles.sub}>{v.subtitle}</Text> : null}
        {v.badge ? <View style={styles.badge}><Badge label={titleCaseStatus(v.badge)} tone={v.tone ?? "neutral"} /></View> : null}
      </View>
      {list.stepKey ? <NextStepBar formKey={list.stepKey} id={String(record.id)} status={status} record={record} /> : null}
      <SectionCard title="Details">
        {fields.map(([k, val]) => <DetailRow key={k} label={label(k)} value={show(val)} />)}
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },
    header: { gap: 4 },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    sub: { fontSize: fontSize.sm, color: colors.mutedForeground },
    badge: { alignSelf: "flex-start", marginTop: spacing.xs },
  });
}
