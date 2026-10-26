import { useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewToken } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";

interface Slide {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: "briefcase",
    title: "Welcome to Vrodux ERP",
    body: "Your business in your pocket. Check on sales, people, stock and customers, and act on them from wherever you are.",
  },
  {
    icon: "grid",
    title: "Your modules",
    body: "The tabs along the bottom are your modules. Anything that doesn't fit lives under More. What you see depends on your role, so you only get what you need.",
  },
  {
    icon: "check-circle",
    title: "Get things done on the move",
    body: "Update leads and deals, mark attendance, approve requests, take restaurant orders, run a checkout and scan barcodes with the camera.",
  },
  {
    icon: "message-circle",
    title: "Ask the AI assistant",
    body: "Tap the floating button and ask a question or tell it what to do. Anything it wants to create or change is shown to you first, and nothing is saved until you confirm.",
  },
  {
    icon: "bell",
    title: "Stay in the loop",
    body: "The bell shows what needs you: new leads, approvals and assignments. Turn on notifications and they reach you even when the app is closed.",
  },
  {
    icon: "sliders",
    title: "Make it yours",
    body: "In Settings you can switch between light and dark mode, secure your account with two-factor sign-in, and see or sign out your devices. You can replay this tour from there at any time.",
  },
];

/**
 * First-run tour, shown once after the first sign-in on a device. Skippable from every slide; the same
 * component is reopened from Settings → Help. Plain horizontal paging (no animation library) so it adds
 * no native dependency.
 */
export function Walkthrough({ visible, onFinish }: { visible: boolean; onFinish: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.index;
    if (first != null) setIndex(first);
  }).current;

  function next() {
    if (last) {
      onFinish();
      setIndex(0);
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  function finish() {
    onFinish();
    setIndex(0);
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish} statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.topRow}>
          <Text style={styles.step}>{index + 1} / {SLIDES.length}</Text>
          {!last ? (
            <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip the tour">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : <View />}
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.title}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={styles.iconWrap}>
                <Feather name={item.icon} size={44} color={colors.primary} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.footer}>
          <Button label={last ? "Get started" : "Next"} icon={last ? "check" : "arrow-right"} onPress={next} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, minHeight: 32 },
    step: { fontSize: fontSize.sm, color: colors.mutedForeground, fontWeight: fontWeight.medium },
    skip: { fontSize: fontSize.base, color: colors.primary, fontWeight: fontWeight.semibold },
    slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl * 1.5, gap: spacing.lg },
    iconWrap: { width: 112, height: 112, borderRadius: radius.full, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
    title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground, textAlign: "center" },
    body: { fontSize: fontSize.base, lineHeight: 22, color: colors.mutedForeground, textAlign: "center" },
    dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.lg },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { width: 22, backgroundColor: colors.primary },
    footer: { paddingHorizontal: spacing.xl },
  });
}
