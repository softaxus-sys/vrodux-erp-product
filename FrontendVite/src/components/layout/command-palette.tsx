import * as React from "react";
import { useNavigate as useRouter, useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUiStore } from "@/store/ui.store";
import { useTranslation } from "react-i18next";
import { useVisibleNavigation } from "@/hooks/use-visible-navigation";
import { useAuthStore } from "@/store/auth.store";
import type { ModuleKey } from "@/types/global";

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const hasModuleAccess = useAuthStore(s => s.hasModuleAccess);
  // The SAME filtered list the sidebar renders. This used to walk the raw config, so global
  // search offered HR, CRM and Finance to a shop licensed for none of them — and every result
  // navigated to a route ModuleGuard then bounced.
  const navigationConfig = useVisibleNavigation();

  const allNavItems = React.useMemo(() => {
    const items: Array<{ label: string; href: string; group: string }> = [];
    navigationConfig.forEach((group) => {
      group.items.forEach((item) => {
        if (item.href) items.push({ label: item.label, href: item.href, group: group.label });
        item.children?.forEach((child) => {
          if (child.href) items.push({ label: child.label, href: child.href, group: item.label });
        });
      });
    });
    return items;
  }, [navigationConfig]);

  const quickActions = React.useMemo(() => {
    // These point at the LIST page, not a "/new" route. No /new route has ever existed for any of
    // them — creation happens in a drawer on the list page — so every one of these previously fell
    // through to the catch-all and silently redirected to the dashboard.
    const all = [
      { label: t("command.createInvoice"),    href: "/finance/invoicing", module: "finance"  },
      { label: t("command.addEmployee"),      href: "/hr/employees",      module: "hr"       },
      { label: t("command.newPurchaseOrder"), href: "/purchase/orders",   module: "purchase" },
      { label: t("command.addCustomer"),      href: "/crm/customers",     module: "crm"      },
      { label: t("command.newQuotation"),     href: "/sales/quotations",  module: "sales"    },
    ];
    // Gated too: offering "Create Invoice" to a shop without Finance is the same broken promise
    // as listing the module itself.
    return all.filter(a => hasModuleAccess(a.module as ModuleKey));
  }, [t, hasModuleAccess]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setCommandPaletteOpen]);

  const run = (href: string) => {
    setCommandPaletteOpen(false);
    navigate(href);
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.noResults")}</CommandEmpty>
        <CommandGroup heading={t("command.quickActions")}>
          {quickActions.map((action) => (
            <CommandItem key={action.href} onSelect={() => run(action.href)}>
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("command.navigation")}>
          {allNavItems.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => run(item.href)}
              value={`${item.group} ${item.label}`}
            >
              <span className="text-muted-foreground text-xs mr-2">{item.group}</span>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}


