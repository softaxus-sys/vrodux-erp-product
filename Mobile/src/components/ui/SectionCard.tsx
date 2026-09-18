import { StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";

interface SectionCardProps {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

/** The titled-card pattern repeated across every detail screen (was a local `Section` component
 *  duplicated ~15 times) -- one shared, consistently-styled version. */
export function SectionCard({ title, right, children }: SectionCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Card variant="flat" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {right}
      </View>
      {children}
    </Card>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: { gap: spacing.sm, backgroundColor: colors.cardMuted },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
  });
}
