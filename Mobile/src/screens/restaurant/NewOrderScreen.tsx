import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CartReviewModal } from "@/components/restaurant/CartReviewModal";
import { ModifierPickerModal } from "@/components/restaurant/ModifierPickerModal";
import { useAddOrderItems, useCreateOrder, useMenu, useOpenShift, useOrder } from "@/hooks/use-restaurant";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { ORDER_TYPE_LABELS, ORDER_TYPES } from "@/types/restaurant";
import type { CartLineSelection, MenuItemDto } from "@/types/restaurant";
import { Badge, Chip, EmptyListState, ErrorState, LoadingState, SearchInput } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RestaurantStackParamList, "NewOrder">;

/** One screen handles both "start a new order" and "add items to an existing one" -- see
 *  navigation/types.ts's comment on why. The till check (useOpenShift) is what makes ordering on
 *  a phone safe: a waiter never opens their own session, they ride whichever cashier already has
 *  one open (see types/restaurant.ts's top-of-file note). */
export default function NewOrderScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tableId, tableNumber, orderId, orderNumber } = route.params ?? {};
  const isAddingToExisting = Boolean(orderId);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");
  const myName = useAuthStore((s) => s.user?.fullName ?? "");

  useEffect(() => {
    navigation.setOptions({ headerTitle: isAddingToExisting ? `Add Items · ${orderNumber}` : tableNumber ? `Table ${tableNumber}` : "New Order" });
  }, [navigation, isAddingToExisting, orderNumber, tableNumber]);

  const openShift = useOpenShift(!isAddingToExisting);
  const existingOrder = useOrder(isAddingToExisting ? orderId! : "");
  const menu = useMenu();
  const createOrder = useCreateOrder();
  const addItems = useAddOrderItems();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [orderType, setOrderType] = useState<string>(tableId ? "dine_in" : "takeaway");
  const [covers, setCovers] = useState(2);
  const [waiter, setWaiter] = useState(myName);
  const [cart, setCart] = useState<CartLineSelection[]>([]);
  const [notes, setNotes] = useState("");
  const [pickerItem, setPickerItem] = useState<MenuItemDto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (myName && !waiter) setWaiter(myName);
  }, [myName, waiter]);

  const categories = menu.data ?? [];
  const items = useMemo(() => {
    const all = categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id })));
    const byCategory = activeCategory === "all" ? all : all.filter((i) => i.categoryId === activeCategory);
    const term = search.trim().toLowerCase();
    return term ? byCategory.filter((i) => i.name.toLowerCase().includes(term)) : byCategory;
  }, [categories, activeCategory, search]);

  function addToCart(item: MenuItemDto, selectedModifierIds: string[], quantity: number) {
    const selectedModifiers = item.modifierGroups.flatMap((g) => g.modifiers).filter((m) => selectedModifierIds.includes(m.id));
    const unitPriceWithModifiers = item.price + selectedModifiers.reduce((sum, m) => sum + m.priceDelta, 0);
    const modifierSummary = selectedModifiers.length > 0 ? selectedModifiers.map((m) => m.name).join(", ") : null;
    setCart((prev) => {
      // Merge only when the modifier selection matches exactly -- two "Large Pizza"s with
      // different sizes are different lines, not one row with a confusing combined quantity.
      const matchIndex = prev.findIndex(
        (l) => l.menuItem.id === item.id && JSON.stringify([...l.selectedModifierIds].sort()) === JSON.stringify([...selectedModifierIds].sort())
      );
      if (matchIndex >= 0) {
        const next = [...prev];
        next[matchIndex] = { ...next[matchIndex], quantity: next[matchIndex].quantity + quantity };
        return next;
      }
      return [...prev, { menuItem: item, quantity, selectedModifierIds, modifierSummary, unitPriceWithModifiers }];
    });
  }

  function handleItemPress(item: MenuItemDto) {
    if (!item.isAvailable) return;
    if (item.modifierGroups.length > 0) {
      setPickerItem(item);
    } else {
      addToCart(item, [], 1);
    }
  }

  const mutation = isAddingToExisting ? addItems : createOrder;
  const apiError = mutation.error instanceof ApiError ? mutation.error.message : mutation.error ? "Something went wrong." : null;

  function handleSubmit() {
    const lineItems = cart.map((l) => ({
      menuItemId: l.menuItem.id,
      quantity: l.quantity,
      selectedModifierIds: l.selectedModifierIds.length > 0 ? l.selectedModifierIds : undefined,
    }));

    if (isAddingToExisting) {
      addItems.mutate(
        { id: orderId!, items: lineItems },
        { onSuccess: () => navigation.goBack() }
      );
      return;
    }

    createOrder.mutate(
      {
        tableId: tableId ?? null,
        waiter: waiter.trim() || "Staff",
        covers,
        orderType,
        notes: notes.trim() || null,
        items: lineItems,
        sessionId: openShift.data?.sessionId ?? null,
      },
      {
        onSuccess: (order) => {
          setCartOpen(false);
          navigation.replace("OrderDetail", { orderId: order.id, orderNumber: order.orderNumber });
        },
      }
    );
  }

  // No open till -- ordering would have nowhere to settle against. Block before the menu even
  // loads, same "fail early and say why" rule used throughout this app's write paths.
  if (!isAddingToExisting && openShift.isError) {
    return <ErrorState message="Couldn't check whether a till is open." onRetry={() => openShift.refetch()} />;
  }
  if (!isAddingToExisting && openShift.isLoading) {
    return <LoadingState />;
  }
  if (!isAddingToExisting && openShift.data && !openShift.data.isOpen) {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedTitle}>No till is open</Text>
        <Text style={styles.blockedText}>
          Orders ride under a cashier's open shift. Ask a cashier to open one on the till before taking orders.
        </Text>
      </View>
    );
  }
  if (isAddingToExisting && existingOrder.isError) {
    return <ErrorState message="Couldn't load this order." onRetry={() => existingOrder.refetch()} />;
  }

  return (
    <View style={styles.container}>
      {!isAddingToExisting ? (
        <View style={styles.setupBar}>
          {!tableId ? (
            <View style={styles.typeRow}>
              {ORDER_TYPES.filter((t) => t !== "dine_in").map((t) => (
                <Chip key={t} label={ORDER_TYPE_LABELS[t]} active={orderType === t} onPress={() => setOrderType(t)} />
              ))}
            </View>
          ) : null}
          <View style={styles.setupRow}>
            <Text style={styles.setupLabel}>Covers</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepperButton} onPress={() => setCovers((c) => Math.max(1, c - 1))}>
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{covers}</Text>
              <Pressable style={styles.stepperButton} onPress={() => setCovers((c) => c + 1)}>
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
          <TextInput style={styles.waiterInput} value={waiter} onChangeText={setWaiter} placeholder="Waiter name" placeholderTextColor={colors.subtleForeground} />
        </View>
      ) : null}

      <SearchInput value={search} onChangeText={setSearch} placeholder="Search the menu…" />

      <View style={styles.categoryRow}>
        <Chip label="All" active={activeCategory === "all"} onPress={() => setActiveCategory("all")} />
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} active={activeCategory === c.id} onPress={() => setActiveCategory(c.id)} />
        ))}
      </View>

      {menu.isError ? (
        <ErrorState message="Couldn't load the menu." onRetry={() => menu.refetch()} />
      ) : menu.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyListState icon="menu" title="No dishes match" />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.itemRow, !item.isAvailable && styles.itemRowUnavailable]}
              disabled={!item.isAvailable}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.itemBody}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.itemDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemPrice}>
                  {currency} {item.price.toFixed(2)}
                </Text>
                {!item.isAvailable ? <Badge label="Unavailable" tone="neutral" /> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={[styles.cartBar, cart.length === 0 && { backgroundColor: colors.muted }]}
        onPress={() => setCartOpen(true)}
        disabled={cart.length === 0}
      >
        <Text style={[styles.cartBarText, cart.length === 0 && { color: colors.mutedForeground }]}>
          {cart.length === 0
            ? "Add items from the menu"
            : `Cart · ${cart.reduce((n, l) => n + l.quantity, 0)} item${cart.length === 1 ? "" : "s"} · ${currency} ${cart
                .reduce((s, l) => s + l.unitPriceWithModifiers * l.quantity, 0)
                .toFixed(2)}`}
        </Text>
      </Pressable>

      <ModifierPickerModal
        visible={pickerItem !== null}
        menuItem={pickerItem}
        currency={currency}
        onAdd={(ids, qty) => {
          if (pickerItem) addToCart(pickerItem, ids, qty);
          setPickerItem(null);
        }}
        onCancel={() => setPickerItem(null)}
      />

      <CartReviewModal
        visible={cartOpen}
        lines={cart}
        currency={currency}
        notes={notes}
        busy={mutation.isPending}
        errorMessage={apiError}
        submitLabel={isAddingToExisting ? "Add to order" : "Create order"}
        onNotesChange={setNotes}
        onChangeQuantity={(index, quantity) => setCart((prev) => prev.map((l, i) => (i === index ? { ...l, quantity } : l)))}
        onRemove={(index) => setCart((prev) => prev.filter((_, i) => i !== index))}
        onSubmit={handleSubmit}
        onClose={() => setCartOpen(false)}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    blockedContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
    blockedTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    blockedText: { fontSize: fontSize.base, color: colors.mutedForeground, textAlign: "center" },

    setupBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
    typeRow: { flexDirection: "row", gap: spacing.sm },
    setupRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    setupLabel: { fontSize: fontSize.sm, color: colors.mutedForeground },
    stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stepperButton: { width: 30, height: 30, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    stepperButtonText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.foreground },
    stepperValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground, minWidth: 20, textAlign: "center" },
    waiterInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.card },

    categoryRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginVertical: spacing.sm },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },

    itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    itemRowUnavailable: { opacity: 0.5 },
    itemBody: { flex: 1, marginRight: spacing.sm },
    itemName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
    itemDescription: { fontSize: fontSize.sm, color: colors.mutedForeground },
    itemRight: { alignItems: "flex-end", gap: 2 },
    itemPrice: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },

    cartBar: { backgroundColor: colors.primary, paddingVertical: spacing.md, alignItems: "center" },
    cartBarText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.onPrimary },
  });
}
