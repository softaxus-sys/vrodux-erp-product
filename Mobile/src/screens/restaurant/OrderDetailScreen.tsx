import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomerPickerModal } from "@/components/restaurant/CustomerPickerModal";
import { DeliverySetupModal } from "@/components/restaurant/DeliverySetupModal";
import { DiscountModal, type DiscountInput } from "@/components/restaurant/DiscountModal";
import { LoyaltyModal } from "@/components/restaurant/LoyaltyModal";
import { PaymentModal, type PaymentInput } from "@/components/restaurant/PaymentModal";
import { ReasonModal } from "@/components/restaurant/ReasonModal";
import { RefundModal, type RefundInput } from "@/components/restaurant/RefundModal";
import { SplitBillModal } from "@/components/restaurant/SplitBillModal";
import { TipModal } from "@/components/restaurant/TipModal";
import { WaiterModal } from "@/components/restaurant/WaiterModal";
import {
  useAddOrderPayment,
  useApplyOrderDiscount,
  useCancelOrder,
  useCreateDeliveryOrder,
  useCustomerById,
  useFireNextCourse,
  useHoldOrder,
  useOrder,
  usePayOrder,
  useRecallOrder,
  useRedeemOrderLoyalty,
  useRefundOrder,
  useRemoveOrderDiscount,
  useSendOrderToKitchen,
  useServeOrder,
  useSetOrderCustomer,
  useSetOrderTip,
  useSetOrderWaiter,
  useSplitOrder,
  useVoidOrderItem,
} from "@/hooks/use-restaurant";
import { ApiError } from "@/lib/api-client";
import { RESTAURANT_ORDERS_DISCOUNT, RESTAURANT_ORDERS_EDIT, RESTAURANT_ORDERS_REFUND, RESTAURANT_ORDERS_VOID } from "@/lib/restaurant.api";
import { formatCompactValue } from "@/lib/crm-helpers";
import { hasPermission, useAuthStore } from "@/store/auth.store";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, ORDER_TYPE_LABELS } from "@/types/restaurant";
import type { CustomerLiteDto } from "@/types/restaurant";
import { Badge, Button, DetailRow, ErrorState, LoadingState, SectionCard, Stat } from "@/components/ui";
import { fontSize, fontWeight, spacing, useAppTheme, type AppColors } from "@/theme";
import type { RestaurantStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RestaurantStackParamList, "OrderDetail">;

const CLOSED_STATUSES = ["paid", "cancelled", "split", "held"];

type ModalKind =
  | "void" | "cancel" | "discount" | "removeDiscount" | "payment" | "refund" | "tip"
  | "waiter" | "customer" | "loyalty" | "split" | "delivery" | null;

export default function OrderDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { orderId, orderNumber } = route.params;
  useEffect(() => {
    navigation.setOptions({ headerTitle: orderNumber ?? "Order" });
  }, [navigation, orderNumber]);
  const currency = useAuthStore((s) => s.tenant?.currency ?? "");

  const order = useOrder(orderId);
  const [modal, setModal] = useState<ModalKind>(null);
  const [voidItemId, setVoidItemId] = useState<string | null>(null);
  const linkedCustomer = useCustomerById(order.data?.customerId ?? null);

  const canEdit = hasPermission(RESTAURANT_ORDERS_EDIT);
  const canVoid = hasPermission(RESTAURANT_ORDERS_VOID);
  const canDiscount = hasPermission(RESTAURANT_ORDERS_DISCOUNT);
  const canRefund = hasPermission(RESTAURANT_ORDERS_REFUND);

  const voidItem = useVoidOrderItem();
  const cancelOrder = useCancelOrder();
  const applyDiscount = useApplyOrderDiscount();
  const removeDiscount = useRemoveOrderDiscount();
  const payOrder = usePayOrder();
  const addPayment = useAddOrderPayment();
  const refundOrder = useRefundOrder();
  const setTip = useSetOrderTip();
  const setWaiter = useSetOrderWaiter();
  const setCustomer = useSetOrderCustomer();
  const redeemLoyalty = useRedeemOrderLoyalty();
  const holdOrder = useHoldOrder();
  const recallOrder = useRecallOrder();
  const fireNextCourse = useFireNextCourse();
  const sendToKitchen = useSendOrderToKitchen();
  const serveOrder = useServeOrder();
  const splitOrder = useSplitOrder();
  const createDelivery = useCreateDeliveryOrder();

  const activeMutation = [
    voidItem, cancelOrder, applyDiscount, removeDiscount, payOrder, addPayment, refundOrder,
    setTip, setWaiter, setCustomer, redeemLoyalty, holdOrder, recallOrder, fireNextCourse,
    sendToKitchen, serveOrder, splitOrder, createDelivery,
  ].find((m) => m.isPending || m.isError);
  const liveError = activeMutation?.error instanceof ApiError ? activeMutation.error.message : null;

  function closeModal() {
    setModal(null);
    setVoidItemId(null);
  }

  if (order.isLoading || !order.data) {
    return <LoadingState />;
  }
  if (order.isError) {
    return <ErrorState message="Couldn't load this order." onRetry={() => order.refetch()} />;
  }

  const o = order.data;
  const isClosed = CLOSED_STATUSES.includes(o.status);
  const activeDiscount = o.discounts.find((d) => !d.isVoided) ?? null;
  const isBusy = Boolean(activeMutation?.isPending);

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.name}>{o.orderType === "dine_in" ? `Table ${o.tableNumber}` : ORDER_TYPE_LABELS[o.orderType] ?? o.orderType}</Text>
          <View style={styles.subtitleRow}>
            <Badge label={ORDER_STATUS_LABELS[o.status] ?? o.status} tone={ORDER_STATUS_TONE[o.status] ?? "neutral"} />
            <Text style={styles.subtitle}>
              {o.waiter} · {o.covers} cover{o.covers === 1 ? "" : "s"} · {o.orderNumber}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Stat label="Subtotal" value={formatCompactValue(o.subTotal, currency)} />
            {o.discountAmount > 0 ? <Stat label="Discount" value={`-${formatCompactValue(o.discountAmount, currency)}`} /> : null}
            <Stat label="Tax" value={formatCompactValue(o.taxAmount, currency)} />
            {o.tipAmount > 0 ? <Stat label="Tip" value={formatCompactValue(o.tipAmount, currency)} /> : null}
            <Stat label="Total" value={formatCompactValue(o.total + o.tipAmount, currency)} tone="primary" />
          </View>
          {o.outstanding > 0.01 ? (
            <Text style={styles.outstanding}>Outstanding: {formatCompactValue(o.outstanding, currency)}</Text>
          ) : null}
        </View>

        {liveError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{liveError}</Text>
          </View>
        ) : null}

        {/* ── Action bar -- gated the same way the backend's own handlers are, so a tap that
           would 409/403 server-side is simply not offered. ── */}
        <View style={styles.actionRow}>
          {o.status === "open" && o.items.length > 0 ? (
            <Button label="Send to Kitchen" size="sm" disabled={isBusy} onPress={() => sendToKitchen.mutate(o.id)} />
          ) : null}
          {o.status === "ready" ? (
            <Button label="Serve" size="sm" disabled={isBusy} onPress={() => serveOrder.mutate(o.id)} />
          ) : null}
          {!isClosed && canEdit ? (
            <Button
              label="Add Items"
              size="sm"
              variant="outline"
              onPress={() => navigation.navigate("NewOrder", { orderId: o.id, orderNumber: o.orderNumber })}
            />
          ) : null}
          {!isClosed && o.items.length > 0 ? (
            <Button label="Fire Next Course" size="sm" variant="outline" disabled={isBusy} onPress={() => fireNextCourse.mutate(o.id)} />
          ) : null}
          {o.status === "open" ? (
            <Button label="Hold" size="sm" variant="outline" disabled={isBusy} onPress={() => holdOrder.mutate(o.id)} />
          ) : null}
          {o.status === "held" ? (
            <Button label="Recall Order" disabled={isBusy} onPress={() => recallOrder.mutate(o.id)} />
          ) : null}
          {!isClosed && canDiscount && !activeDiscount ? (
            <Button label="Discount" size="sm" variant="outline" onPress={() => setModal("discount")} />
          ) : null}
          {!isClosed && canDiscount && activeDiscount ? (
            <Button label="Remove Discount" size="sm" variant="outline" onPress={() => setModal("removeDiscount")} />
          ) : null}
          {!isClosed ? <Button label="Tip" size="sm" variant="outline" onPress={() => setModal("tip")} /> : null}
          {!isClosed ? <Button label={o.customerId ? "Customer" : "Link Customer"} size="sm" variant="outline" onPress={() => setModal("customer")} /> : null}
          {!isClosed && o.customerId ? <Button label="Loyalty" size="sm" variant="outline" onPress={() => setModal("loyalty")} /> : null}
          {!isClosed ? <Button label="Waiter" size="sm" variant="outline" onPress={() => setModal("waiter")} /> : null}
          {!isClosed && canEdit && o.items.filter((i) => !i.status || i.status !== "void").length > 1 ? (
            <Button label="Split Bill" size="sm" variant="outline" onPress={() => setModal("split")} />
          ) : null}
          {!isClosed && o.outstanding > 0.01 ? (
            <Button label="Take Payment" disabled={isBusy} onPress={() => setModal("payment")} />
          ) : null}
          {canRefund && o.amountPaid > 0 ? (
            <Button label="Refund" size="sm" variant="destructive" onPress={() => setModal("refund")} />
          ) : null}
          {!isClosed && canVoid ? (
            <Button label="Cancel Order" size="sm" variant="destructive" onPress={() => setModal("cancel")} />
          ) : null}
          {o.orderType === "delivery" ? (
            <Button label="Start Delivery" size="sm" variant="outline" disabled={isBusy} onPress={() => setModal("delivery")} />
          ) : null}
        </View>

        {o.notes ? (
          <SectionCard title="Notes">
            <Text style={styles.bodyText}>{o.notes}</Text>
          </SectionCard>
        ) : null}

        <SectionCard title={`Items (${o.items.length})`}>
          {o.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemTop}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.quantity}× {item.itemName}
                </Text>
                <Text style={styles.itemTotal}>{formatCompactValue(item.lineTotal, currency)}</Text>
              </View>
              {item.selectedModifiers.length > 0 ? (
                <Text style={styles.itemMeta}>{item.selectedModifiers.map((m) => m.name).join(", ")}</Text>
              ) : item.modifiers ? (
                <Text style={styles.itemMeta}>{item.modifiers}</Text>
              ) : null}
              <View style={styles.itemBottomRow}>
                <Text style={styles.itemStatus}>{item.status}</Text>
                {!isClosed && canVoid && item.status !== "void" ? (
                  <Text
                    style={styles.voidLink}
                    onPress={() => {
                      setVoidItemId(item.id);
                      setModal("void");
                    }}
                  >
                    Void
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </SectionCard>

        {o.payments.length > 0 ? (
          <SectionCard title="Payments">
            {o.payments.map((p) => (
              <DetailRow key={p.id} label={p.method} value={formatCompactValue(p.amount, currency)} />
            ))}
          </SectionCard>
        ) : null}

        {o.discounts.filter((d) => !d.isVoided).length > 0 ? (
          <SectionCard title="Discounts">
            {o.discounts
              .filter((d) => !d.isVoided)
              .map((d) => (
                <DetailRow key={d.id} label={d.reason} value={`-${formatCompactValue(d.amount, currency)}`} />
              ))}
          </SectionCard>
        ) : null}

        {o.refunds.length > 0 ? (
          <SectionCard title="Refunds">
            {o.refunds.map((r) => (
              <DetailRow key={r.id} label={r.reason} value={formatCompactValue(r.amount, currency)} />
            ))}
          </SectionCard>
        ) : null}

        {o.splits.length > 0 ? (
          <SectionCard title={`Split into ${o.splits.length}`}>
            {o.splits.map((s) => (
              <Text
                key={s.id}
                style={styles.splitRow}
                onPress={() => navigation.push("OrderDetail", { orderId: s.id, orderNumber: s.orderNumber })}
              >
                {s.orderNumber} · {s.status} ·{" "}
                {s.outstanding > 0.01 ? `${formatCompactValue(s.outstanding, currency)} due` : "Paid"}
              </Text>
            ))}
          </SectionCard>
        ) : null}
      </ScrollView>

      <ReasonModal
        visible={modal === "void"}
        title="Void Item"
        destructive
        confirmLabel="Void"
        busy={voidItem.isPending}
        errorMessage={voidItem.error instanceof ApiError ? voidItem.error.message : null}
        onConfirm={(reason) => voidItemId && voidItem.mutate({ id: o.id, itemId: voidItemId, reason }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <ReasonModal
        visible={modal === "cancel"}
        title="Cancel Order"
        hint="This voids the whole order."
        destructive
        confirmLabel="Cancel Order"
        busy={cancelOrder.isPending}
        errorMessage={cancelOrder.error instanceof ApiError ? cancelOrder.error.message : null}
        onConfirm={(reason) => cancelOrder.mutate({ id: o.id, reason }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <ReasonModal
        visible={modal === "removeDiscount"}
        title="Remove Discount"
        confirmLabel="Remove"
        busy={removeDiscount.isPending}
        errorMessage={removeDiscount.error instanceof ApiError ? removeDiscount.error.message : null}
        onConfirm={(reason) => removeDiscount.mutate({ id: o.id, reason }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <DiscountModal
        visible={modal === "discount"}
        subTotal={o.subTotal}
        currency={currency}
        busy={applyDiscount.isPending}
        errorMessage={applyDiscount.error instanceof ApiError ? applyDiscount.error.message : null}
        onConfirm={(input: DiscountInput) =>
          applyDiscount.mutate({ id: o.id, ...input }, { onSuccess: closeModal })
        }
        onCancel={closeModal}
      />
      <PaymentModal
        visible={modal === "payment"}
        outstanding={o.outstanding}
        currency={currency}
        busy={payOrder.isPending || addPayment.isPending}
        errorMessage={
          payOrder.error instanceof ApiError ? payOrder.error.message : addPayment.error instanceof ApiError ? addPayment.error.message : null
        }
        onConfirm={(input: PaymentInput) => {
          if (Math.abs(input.amount - o.outstanding) < 0.01) {
            payOrder.mutate({ id: o.id, method: input.method }, { onSuccess: closeModal });
          } else {
            addPayment.mutate({ id: o.id, method: input.method, amount: input.amount, reference: input.reference }, { onSuccess: closeModal });
          }
        }}
        onCancel={closeModal}
      />
      <RefundModal
        visible={modal === "refund"}
        amountPaid={o.amountPaid}
        currency={currency}
        busy={refundOrder.isPending}
        errorMessage={refundOrder.error instanceof ApiError ? refundOrder.error.message : null}
        onConfirm={(input: RefundInput) => refundOrder.mutate({ id: o.id, ...input }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <TipModal
        visible={modal === "tip"}
        subTotal={o.subTotal}
        currency={currency}
        currentTip={o.tipAmount}
        busy={setTip.isPending}
        errorMessage={setTip.error instanceof ApiError ? setTip.error.message : null}
        onConfirm={(amount) => setTip.mutate({ id: o.id, amount }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <WaiterModal
        visible={modal === "waiter"}
        currentWaiter={o.waiter}
        busy={setWaiter.isPending}
        errorMessage={setWaiter.error instanceof ApiError ? setWaiter.error.message : null}
        onConfirm={(waiter) => setWaiter.mutate({ id: o.id, waiter }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <CustomerPickerModal
        visible={modal === "customer"}
        currentCustomerId={o.customerId}
        busy={setCustomer.isPending}
        errorMessage={setCustomer.error instanceof ApiError ? setCustomer.error.message : null}
        onSelect={(c: CustomerLiteDto) => setCustomer.mutate({ id: o.id, customerId: c.id }, { onSuccess: closeModal })}
        onUnlink={() => setCustomer.mutate({ id: o.id, customerId: null }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <LoyaltyModal
        visible={modal === "loyalty"}
        customerName={linkedCustomer.data?.name ?? "this customer"}
        // The customer's own balance already reflects whatever is currently spent on THIS order
        // (RedeemOrderLoyaltyHandler moves points atomically), so adding back what is already
        // redeemed here gives the true total available to reallocate.
        availablePoints={(linkedCustomer.data?.loyaltyPoints ?? 0) + (activeDiscount?.type === "loyalty" ? activeDiscount.amount : 0)}
        subTotal={o.subTotal}
        currentlyRedeemed={activeDiscount?.type === "loyalty" ? activeDiscount.amount : 0}
        currency={currency}
        busy={redeemLoyalty.isPending}
        errorMessage={redeemLoyalty.error instanceof ApiError ? redeemLoyalty.error.message : null}
        onConfirm={(points) => redeemLoyalty.mutate({ id: o.id, points }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <SplitBillModal
        visible={modal === "split"}
        items={o.items.filter((i) => i.status !== "void")}
        currency={currency}
        busy={splitOrder.isPending}
        errorMessage={splitOrder.error instanceof ApiError ? splitOrder.error.message : null}
        onConfirm={(groups) => splitOrder.mutate({ id: o.id, groups }, { onSuccess: closeModal })}
        onCancel={closeModal}
      />
      <DeliverySetupModal
        visible={modal === "delivery"}
        busy={createDelivery.isPending}
        errorMessage={createDelivery.error instanceof ApiError ? createDelivery.error.message : null}
        onConfirm={(input) =>
          createDelivery.mutate(
            { orderId: o.id, ...input },
            { onSuccess: (d) => navigation.navigate("DeliveryOrderDetail", { deliveryOrderId: d.id, orderNumber: d.orderNumber }) }
          )
        }
        onCancel={closeModal}
      />
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { gap: spacing.xs },
    name: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.foreground },
    subtitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    subtitle: { fontSize: fontSize.md, color: colors.mutedForeground },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl, marginTop: spacing.sm },
    outstanding: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.warning, marginTop: spacing.xs },

    errorBanner: { backgroundColor: colors.destructive, borderRadius: 10, padding: spacing.sm },
    errorBannerText: { color: "#fff", fontSize: fontSize.sm },

    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

    bodyText: { fontSize: fontSize.md, color: colors.foreground },

    itemRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs, gap: 2 },
    itemTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    itemName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground, flexShrink: 1 },
    itemTotal: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
    itemMeta: { fontSize: fontSize.sm, color: colors.mutedForeground },
    itemBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    itemStatus: { fontSize: fontSize.xs, color: colors.subtleForeground, textTransform: "uppercase", letterSpacing: 0.3 },
    voidLink: { fontSize: fontSize.xs, color: colors.destructive, fontWeight: fontWeight.semibold },

    splitRow: { fontSize: fontSize.base, color: colors.primary, paddingVertical: spacing.xs },
  });
}
