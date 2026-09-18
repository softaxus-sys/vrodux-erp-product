import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import type { Feather } from "@expo/vector-icons";
import { Chip, EmptyListState, ErrorState, LoadingState, SearchInput } from "@/components/ui";
import { spacing, useAppTheme } from "@/theme";

export interface StatusFilterOption {
  key: string;
  label: string;
}

/**
 * The chrome every B2B/Education/Healthcare/Insurance list screen shares -- search, status
 * chips, infinite scroll, pull-to-refresh, loading/error/empty states. Pairs with
 * `hooks/use-vertical-list.ts`'s `usePagedVerticalList`; each concrete screen supplies only its
 * own `statusFilters` and `renderItem`.
 */
export function PagedListView<T>({
  items,
  keyExtractor,
  renderItem,
  isLoading,
  isError,
  isFetching,
  isRefetching,
  hasMore,
  onRefresh,
  onLoadMore,
  onRetry,
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  statusFilters,
  emptyIcon,
  emptyTitle,
}: {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  status: string;
  onStatusChange: (v: string) => void;
  statusFilters: StatusFilterOption[];
  emptyIcon: keyof typeof Feather.glyphMap;
  emptyTitle: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SearchInput value={search} onChangeText={onSearchChange} placeholder={searchPlaceholder} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm }}>
        {statusFilters.map((f) => (
          <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => onStatusChange(f.key)} />
        ))}
      </View>

      {isError ? (
        <ErrorState message="Couldn't load this." onRetry={onRetry} />
      ) : isLoading && items.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          contentContainerStyle={items.length === 0 ? undefined : { paddingVertical: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={onLoadMore}
          ListEmptyComponent={<EmptyListState icon={emptyIcon} title={emptyTitle} />}
          ListFooterComponent={hasMore && isFetching ? <ActivityIndicator style={{ paddingVertical: spacing.lg }} color={colors.primary} /> : null}
          renderItem={({ item }) => renderItem(item)}
        />
      )}
    </View>
  );
}
