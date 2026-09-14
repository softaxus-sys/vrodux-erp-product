import { StyleSheet, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fontSize, radius, spacing, useAppTheme, type AppColors } from "@/theme";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

export function SearchInput({ value, onChangeText, placeholder }: SearchInputProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.wrap}>
      <Feather name="search" size={16} color={colors.subtleForeground} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.subtleForeground}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      margin: spacing.lg,
      marginBottom: spacing.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
    },
    icon: { marginRight: spacing.sm },
    input: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.md,
      color: colors.foreground,
    },
  });
}
