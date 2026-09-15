import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { authApi } from "@/lib/auth.api";
import { useAuthStore, hasModuleAccess, hasPermission } from "@/store/auth.store";
import { formatCompactValue } from "@/lib/crm-helpers";
import { CRM_LEADS_VIEW } from "@/lib/crm.api";
import { useCrmDashboard } from "@/hooks/use-crm-dashboard";
import { HR_EMPLOYEES_VIEW } from "@/lib/hr-directory.api";
import { HR_PERFORMANCE_VIEW } from "@/lib/hr-performance.api";
import { HR_RECRUITMENT_VIEW } from "@/lib/hr-recruitment.api";
import { useHrSummary } from "@/hooks/use-hr-directory";
import { usePerformanceSummary } from "@/hooks/use-hr-performance";
import { useRecruitmentSummary } from "@/hooks/use-hr-recruitment";
import { useAccountingSummary, useBankingSummary } from "@/hooks/use-finance";
import { POS_REPORTS_VIEW, POS_SESSIONS_VIEW, POS_TRANSACTIONS_VIEW } from "@/lib/pos.api";
import { usePosDashboard } from "@/hooks/use-pos";
import { RESTAURANT_REPORTS_VIEW } from "@/lib/restaurant.api";
import { useOwnerDashboard as useRestaurantDashboard } from "@/hooks/use-restaurant";
import { VISA_CASES_VIEW } from "@/lib/visa.api";
import { useVisaDashboard } from "@/hooks/use-visa";
import { REAL_ESTATE_CONTRACTS_VIEW, REAL_ESTATE_PROPERTIES_VIEW } from "@/lib/real-estate.api";
import { useContractsSummary as useRealEstateContractsSummary, usePropertiesSummary } from "@/hooks/use-real-estate";
import { B2B_PROPOSALS_VIEW } from "@/lib/b2b.api";
import { useB2BSummary } from "@/hooks/use-b2b";
import { EDUCATION_ADMISSIONS_VIEW } from "@/lib/education.api";
import { useEducationSummary } from "@/hooks/use-education";
import { HEALTHCARE_PATIENTS_VIEW } from "@/lib/healthcare.api";
import { useHealthcareSummary } from "@/hooks/use-healthcare";
import { INSURANCE_POLICIES_VIEW } from "@/lib/insurance.api";
import { useInsuranceSummary } from "@/hooks/use-insurance";
import { useProjectsSummary as useConstructionProjectsSummary } from "@/hooks/use-construction";
import { useBookingsSummary as useHospitalityBookingsSummary, useRoomsSummary } from "@/hooks/use-hospitality";
import { BrandMark } from "@/components/brand/BrandMark";
import { Badge, Button, ErrorState, LoadingState, SectionCard } from "@/components/ui";
import { fontSize, fontWeight, radius, spacing, useAppTheme, type AppColors } from "@/theme";
import type { AppTabParamList } from "@/navigation/types";

/**
 * The one screen every session lands on -- so it's also the one place a "does this account still
 * work" nudge (2FA enrollment) and a cross-module "how's the business doing" glance both belong.
 * Each KPI card below reuses the SAME summary/dashboard hook its own module's home screen already
 * calls -- no new backend integration except CRM's (leads/pipeline never had one; every other
 * module already exposed a dashboard-style summary endpoint this screen just surfaces centrally).
 * Sales/Purchase/Inventory have no tenant-wide totals endpoint at all (confirmed by reading their
 * controllers -- only per-row list DTOs), so they're not represented here; building one is its own
 * backend task, not a client-side aggregation over a paged list (the approach CLAUDE.md's Module 13
 * explicitly flags as an approximation for large tenants, not one to repeat on a phone).
 */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type Props = BottomTabScreenProps<AppTabParamList, "Dashboard">;

export default function HomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const currency = tenant?.currency ?? "";
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const mustSetUpTwoFactor = useAuthStore((s) => s.mustSetUpTwoFactor);
  const clearMustSetUpTwoFactor = useAuthStore((s) => s.clearMustSetUpTwoFactor);
  const logout = useAuthStore((s) => s.logout);

  // ── Per-module gates -- each mirrors that module's own tab-config.ts entry exactly, so a
  // session never sees a KPI card for something its own tab would 403 on. ──────────────────────
  const canCrm = hasModuleAccess("crm") && hasPermission(...CRM_LEADS_VIEW);
  const canHrEmployees = hasModuleAccess("hr") && hasPermission(HR_EMPLOYEES_VIEW);
  const canHrPerformance = hasModuleAccess("hr") && hasPermission(HR_PERFORMANCE_VIEW);
  const canHrRecruitment = hasModuleAccess("hr") && hasPermission(HR_RECRUITMENT_VIEW);
  const canFinance = hasModuleAccess("finance");
  const canPos = hasModuleAccess("pos") && hasPermission(POS_SESSIONS_VIEW, POS_TRANSACTIONS_VIEW, POS_REPORTS_VIEW);
  const canRestaurant = hasModuleAccess("restaurant") && hasPermission(RESTAURANT_REPORTS_VIEW);
  const canVisa = hasModuleAccess("visa") && hasPermission(VISA_CASES_VIEW);
  const canRealEstate = hasModuleAccess("real-estate") && hasPermission(REAL_ESTATE_PROPERTIES_VIEW, REAL_ESTATE_CONTRACTS_VIEW);
  const canRealEstateProperties = canRealEstate && hasPermission(REAL_ESTATE_PROPERTIES_VIEW);
  const canRealEstateContracts = canRealEstate && hasPermission(REAL_ESTATE_CONTRACTS_VIEW);
  const canB2B = hasModuleAccess("b2b") && hasPermission(B2B_PROPOSALS_VIEW);
  const canEducation = hasModuleAccess("education") && hasPermission(EDUCATION_ADMISSIONS_VIEW);
  const canHealthcare = hasModuleAccess("healthcare") && hasPermission(HEALTHCARE_PATIENTS_VIEW);
  const canInsurance = hasModuleAccess("insurance") && hasPermission(INSURANCE_POLICIES_VIEW);
  const canConstruction = hasModuleAccess("construction");
  const canHospitality = hasModuleAccess("hospitality");

  const crmDashboard = useCrmDashboard(canCrm);
  const hrSummary = useHrSummary(canHrEmployees);
  const performanceSummary = usePerformanceSummary(canHrPerformance);
  const recruitmentSummary = useRecruitmentSummary(canHrRecruitment);
  const accountingSummary = useAccountingSummary(canFinance);
  const bankingSummary = useBankingSummary(canFinance);
  const posDashboard = usePosDashboard(canPos);
  const restaurantDashboard = useRestaurantDashboard(canRestaurant);
  const visaDashboard = useVisaDashboard(canVisa);
  const propertiesSummary = usePropertiesSummary(canRealEstateProperties);
  const contractsSummary = useRealEstateContractsSummary(canRealEstateContracts);
  const b2bSummary = useB2BSummary(canB2B);
  const educationSummary = useEducationSummary(canEducation);
  const healthcareSummary = useHealthcareSummary(canHealthcare);
  const insuranceSummary = useInsuranceSummary(canInsurance);
  const projectsSummary = useConstructionProjectsSummary(canConstruction);
  const roomsSummary = useRoomsSummary(canHospitality);
  const bookingsSummary = useHospitalityBookingsSummary(canHospitality);

  const anyKpiVisible =
    canCrm || canHrEmployees || canHrPerformance || canHrRecruitment || canFinance || canPos || canRestaurant || canVisa || canRealEstate || canB2B || canEducation || canHealthcare || canInsurance || canConstruction || canHospitality;

  async function handleLogout() {
    if (refreshToken && accessToken) {
      await authApi.revoke(refreshToken, accessToken);
    }
    logout();
  }

  const firstName = user?.fullName?.split(" ")[0] ?? user?.fullName ?? "there";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <BrandMark size={44} />
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            {greeting()}, {firstName}
          </Text>
          <Text style={styles.tenantLine}>{tenant?.name ?? "—"}</Text>
        </View>
      </View>

      {mustSetUpTwoFactor ? (
        <View style={styles.twoFactorBanner}>
          <View style={styles.twoFactorHeader}>
            <Feather name="shield" size={18} color={colors.warning} />
            <Text style={styles.twoFactorText}>Your workspace now requires two-factor authentication. Set it up to keep your session.</Text>
          </View>
          <Button
            label="Set up now"
            size="sm"
            onPress={() => {
              clearMustSetUpTwoFactor();
              navigation.navigate("Settings");
            }}
          />
        </View>
      ) : null}

      {anyKpiVisible ? (
        <>
          <Text style={styles.sectionLabel}>Overview</Text>

          {canCrm ? (
            <KpiCard
              title="CRM"
              query={crmDashboard}
              tiles={(d) => [
                { label: "Leads", value: String(d.totalLeads) },
                { label: "Open Deals", value: String(d.totalDeals) },
                { label: "Pipeline Value", value: formatCompactValue(d.openPipelineValue, currency), tone: colors.primary },
                { label: "Win Rate", value: `${Math.round(d.winRate)}%`, tone: colors.success },
              ]}
            />
          ) : null}

          {canHrEmployees ? (
            <KpiCard
              title="Employees"
              query={hrSummary}
              tiles={(d) => [
                { label: "Active", value: String(d.active) },
                { label: "On Leave", value: String(d.onLeave), tone: d.onLeave > 0 ? colors.warning : undefined },
                { label: "New This Month", value: String(d.newThisMonth) },
              ]}
            />
          ) : null}

          {canHrPerformance ? (
            <KpiCard
              title="Performance Reviews"
              query={performanceSummary}
              tiles={(d) => [
                { label: "Pending", value: String(d.pending), tone: d.pending > 0 ? colors.warning : undefined },
                { label: "Overdue", value: String(d.overdue), tone: d.overdue > 0 ? colors.destructive : undefined },
                { label: "Avg Rating", value: d.avgRating.toFixed(1) },
              ]}
            />
          ) : null}

          {canHrRecruitment ? (
            <KpiCard
              title="Recruitment"
              query={recruitmentSummary}
              tiles={(d) => [
                { label: "Open Positions", value: String(d.openPositions) },
                { label: "In Interview", value: String(d.inInterview) },
                { label: "Hired This Month", value: String(d.hiredThisMonth), tone: colors.success },
              ]}
            />
          ) : null}

          {canFinance ? (
            <KpiCard
              title="Finance"
              query={combineQueries(accountingSummary, bankingSummary)}
              tiles={([acc, bank]) => [
                { label: "Net Profit", value: formatCompactValue(acc.netProfit, currency), tone: acc.netProfit >= 0 ? colors.success : colors.destructive },
                { label: "Revenue", value: formatCompactValue(acc.totalRevenue, currency) },
                { label: "Bank Balance", value: formatCompactValue(bank.totalBalance, currency), tone: colors.info },
              ]}
            />
          ) : null}

          {canPos ? (
            <KpiCard
              title="POS (Today)"
              query={posDashboard}
              tiles={(d) => [
                { label: "Sales", value: formatCompactValue(d.totalSales, currency), tone: colors.success },
                { label: "Transactions", value: String(d.totalTransactions) },
              ]}
            />
          ) : null}

          {canRestaurant ? (
            <KpiCard
              title="Restaurant (Today)"
              query={restaurantDashboard}
              tiles={(d) => [
                { label: "Sales", value: formatCompactValue(d.todaySales, currency), tone: colors.success },
                { label: "Orders", value: String(d.todayOrders) },
              ]}
            />
          ) : null}

          {canVisa ? (
            <KpiCard
              title="Visa Services"
              query={visaDashboard}
              tiles={(d) => [
                { label: "Open Cases", value: String(d.openCases) },
                { label: "Overdue", value: String(d.overdueCases), tone: d.overdueCases > 0 ? colors.destructive : undefined },
                { label: "Due This Week", value: String(d.dueThisWeek), tone: colors.warning },
              ]}
            />
          ) : null}

          {canRealEstate ? (
            <RealEstateKpiCard
              propertiesQuery={canRealEstateProperties ? propertiesSummary : undefined}
              contractsQuery={canRealEstateContracts ? contractsSummary : undefined}
              currency={currency}
            />
          ) : null}

          {canB2B ? (
            <KpiCard
              title="B2B Services"
              query={b2bSummary}
              tiles={(d) => [
                { label: "Open Proposals", value: String(d.openProposals) },
                { label: "Active Contracts", value: String(d.activeContracts) },
                { label: "Open Tickets", value: String(d.openTickets), tone: d.criticalTickets > 0 ? colors.destructive : undefined },
              ]}
            />
          ) : null}

          {canEducation ? (
            <KpiCard
              title="Education"
              query={educationSummary}
              tiles={(d) => [
                { label: "Enrolled Students", value: String(d.enrolledStudents) },
                { label: "Active Enrollments", value: String(d.activeEnrollments) },
                { label: "Fees Outstanding", value: formatCompactValue(d.feesOutstanding, currency), tone: d.feesOutstanding > 0 ? colors.warning : undefined },
              ]}
            />
          ) : null}

          {canHealthcare ? (
            <KpiCard
              title="Healthcare"
              query={healthcareSummary}
              tiles={(d) => [
                { label: "Patients", value: String(d.patients) },
                { label: "Today's Appointments", value: String(d.todayAppointments) },
                { label: "Active Treatments", value: String(d.activeTreatments) },
              ]}
            />
          ) : null}

          {canInsurance ? (
            <KpiCard
              title="Insurance"
              query={insuranceSummary}
              tiles={(d) => [
                { label: "Active Policies", value: String(d.activePolicies) },
                { label: "Renewals Due", value: String(d.renewalsDue), tone: d.renewalsDue > 0 ? colors.warning : undefined },
                { label: "Open Claims", value: String(d.openClaims) },
              ]}
            />
          ) : null}

          {canConstruction ? (
            <KpiCard
              title="Construction"
              query={projectsSummary}
              tiles={(d) => [
                { label: "In Progress", value: String(d.inProgress) },
                { label: "Avg Completion", value: `${Math.round(d.avgCompletion)}%` },
                { label: "Contract Value", value: formatCompactValue(d.totalContractValue, currency) },
              ]}
            />
          ) : null}

          {canHospitality ? (
            <HospitalityKpiCard roomsQuery={roomsSummary} bookingsQuery={bookingsSummary} currency={currency} />
          ) : null}
        </>
      ) : null}

      <SectionCard title="Workspace">
        <Detail label="Plan" value={tenant?.plan ?? "—"} />
        <Detail label="Currency" value={tenant?.currency ?? "—"} />
        <View style={styles.moduleBlock}>
          <Text style={styles.detailLabel}>Modules ({tenant?.modules.length ?? 0})</Text>
          <View style={styles.chipRow}>
            {tenant?.modules.length ? (
              tenant.modules.map((m) => <Badge key={m} label={m} tone="primary" dot={false} />)
            ) : (
              <Text style={styles.mutedText}>None enabled.</Text>
            )}
          </View>
        </View>
      </SectionCard>

      <View style={styles.signOutRow}>
        <Button label="Sign out" variant="outline" icon="log-out" onPress={handleLogout} fullWidth />
      </View>
    </ScrollView>
  );
}

// ── Shared KPI card ──────────────────────────────────────────────────────────────────────────

interface KpiTile {
  label: string;
  value: string;
  tone?: string;
}

/** The handful of fields KpiCard actually reads -- every React Query `UseQueryResult` satisfies
 *  this structurally, so a real query hook's return value can be passed straight in with no
 *  wrapping, and `combineQueries` below can build one without fighting the full (much larger)
 *  `UseQueryResult` type for fields nothing here uses. */
interface SimpleQuery<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** One SectionCard per module, reusing whatever query that module's own home screen already
 *  fetches with. Handles loading/error/data itself so every call site above is just "what are the
 *  headline numbers." */
function KpiCard<T>({ title, query, tiles }: { title: string; query: SimpleQuery<T>; tiles: (data: T) => KpiTile[] }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SectionCard title={title}>
      {query.isLoading ? (
        <LoadingState size="small" />
      ) : query.isError ? (
        <ErrorState message="Couldn't load this." onRetry={query.refetch} />
      ) : query.data ? (
        <View style={styles.tileRow}>
          {tiles(query.data).map((t) => (
            <View key={t.label} style={styles.miniTile}>
              <Text style={[styles.miniTileValue, t.tone ? { color: t.tone } : null]}>{t.value}</Text>
              <Text style={styles.miniTileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}

/** Combines two independent queries into the single-query shape KpiCard expects -- Finance's
 *  headline numbers span Accounting (net profit/revenue) and Banking (balance), two separate
 *  endpoints with two separate (module-access-only) gates. */
function combineQueries<A, B>(a: SimpleQuery<A>, b: SimpleQuery<B>): SimpleQuery<[A, B]> {
  return {
    data: a.data && b.data ? [a.data, b.data] : undefined,
    isLoading: a.isLoading || b.isLoading,
    isError: a.isError || b.isError,
    refetch: () => {
      a.refetch();
      b.refetch();
    },
  };
}

/** Real Estate's two headline groups (occupancy from Properties, collections from Contracts) are
 *  gated by two independent permission keys -- unlike Finance, either one alone is still worth
 *  showing, so this renders whichever query was actually passed rather than requiring both. */
function RealEstateKpiCard({
  propertiesQuery,
  contractsQuery,
  currency,
}: {
  propertiesQuery?: ReturnType<typeof usePropertiesSummary>;
  contractsQuery?: ReturnType<typeof useRealEstateContractsSummary>;
  currency: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const loading = Boolean(propertiesQuery?.isLoading || contractsQuery?.isLoading);
  const anyError = Boolean(propertiesQuery?.isError || contractsQuery?.isError);
  return (
    <SectionCard title="Real Estate">
      {loading ? (
        <LoadingState size="small" />
      ) : anyError ? (
        <ErrorState message="Couldn't load this." onRetry={() => { propertiesQuery?.refetch(); contractsQuery?.refetch(); }} />
      ) : (
        <View style={styles.tileRow}>
          {propertiesQuery?.data ? (
            <View style={styles.miniTile}>
              <Text style={styles.miniTileValue}>{Math.round(propertiesQuery.data.occupancyRate)}%</Text>
              <Text style={styles.miniTileLabel}>Occupancy</Text>
            </View>
          ) : null}
          {contractsQuery?.data ? (
            <>
              <View style={styles.miniTile}>
                <Text style={[styles.miniTileValue, contractsQuery.data.overdueAmount > 0 ? { color: colors.destructive } : null]}>
                  {formatCompactValue(contractsQuery.data.overdueAmount, currency)}
                </Text>
                <Text style={styles.miniTileLabel}>Overdue Rent</Text>
              </View>
              <View style={styles.miniTile}>
                <Text style={styles.miniTileValue}>{contractsQuery.data.expiringSoon}</Text>
                <Text style={styles.miniTileLabel}>Leases Expiring</Text>
              </View>
            </>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}

function HospitalityKpiCard({
  roomsQuery,
  bookingsQuery,
  currency,
}: {
  roomsQuery: ReturnType<typeof useRoomsSummary>;
  bookingsQuery: ReturnType<typeof useHospitalityBookingsSummary>;
  currency: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const loading = roomsQuery.isLoading || bookingsQuery.isLoading;
  const anyError = roomsQuery.isError || bookingsQuery.isError;
  return (
    <SectionCard title="Hospitality">
      {loading ? (
        <LoadingState size="small" />
      ) : anyError ? (
        <ErrorState message="Couldn't load this." onRetry={() => { roomsQuery.refetch(); bookingsQuery.refetch(); }} />
      ) : (
        <View style={styles.tileRow}>
          {roomsQuery.data ? (
            <View style={styles.miniTile}>
              <Text style={styles.miniTileValue}>{Math.round(roomsQuery.data.occupancyRate)}%</Text>
              <Text style={styles.miniTileLabel}>Occupancy</Text>
            </View>
          ) : null}
          {bookingsQuery.data ? (
            <>
              <View style={styles.miniTile}>
                <Text style={styles.miniTileValue}>{bookingsQuery.data.checkedIn}</Text>
                <Text style={styles.miniTileLabel}>Checked In</Text>
              </View>
              <View style={styles.miniTile}>
                <Text style={[styles.miniTileValue, bookingsQuery.data.outstanding > 0 ? { color: colors.warning } : null]}>
                  {formatCompactValue(bookingsQuery.data.outstanding, currency)}
                </Text>
                <Text style={styles.miniTileLabel}>Outstanding</Text>
              </View>
            </>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.lg },

    header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
    headerText: { flex: 1 },
    greeting: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.foreground },
    tenantLine: { fontSize: fontSize.md, color: colors.mutedForeground, marginTop: 2 },

    twoFactorBanner: { gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md },
    twoFactorHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    twoFactorText: { flex: 1, fontSize: fontSize.base, color: colors.foreground },

    sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 },

    tileRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
    miniTile: { minWidth: 84 },
    miniTileValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground },
    miniTileLabel: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },

    detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    detailLabel: { fontSize: fontSize.base, color: colors.mutedForeground },
    detailValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },

    moduleBlock: { marginTop: spacing.xs, gap: spacing.sm },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    mutedText: { fontSize: fontSize.base, color: colors.subtleForeground },

    signOutRow: { marginTop: spacing.sm },
  });
}
