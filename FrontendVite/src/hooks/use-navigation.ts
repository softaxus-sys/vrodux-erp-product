import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { navigationConfig } from "@/config/navigation";
import type { NavGroup, NavItem } from "@/types";

/**
 * The navigation config with all group + item labels translated into the active
 * language. Keyed by the stable `id` on each group/item (see the nav.json files
 * under i18n/locales); falls back to the config's English `label` when a key is
 * missing.
 *
 * Consumers should use this instead of importing `navigationConfig` directly, so
 * the sidebar, mini-rail, top-nav, and command palette all stay in sync.
 */
export function useNavigation(): NavGroup[] {
  const { t, i18n } = useTranslation("nav");

  return useMemo(() => {
    const translateItem = (item: NavItem): NavItem => ({
      ...item,
      label: t(`item.${item.id}`, { defaultValue: item.label }),
      children: item.children?.map(translateItem),
    });

    return navigationConfig.map((group) => ({
      ...group,
      label: t(`group.${group.id}`, { defaultValue: group.label }),
      items: group.items.map(translateItem),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language]);
}
