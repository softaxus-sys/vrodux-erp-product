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
import { useNavigation } from "@/hooks/use-navigation";

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const navigationConfig = useNavigation();

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

  const quickActions = React.useMemo(() => [
    { label: t("command.createInvoice"),    href: "/finance/invoicing/new" },
    { label: t("command.addEmployee"),      href: "/hr/employees/new" },
    { label: t("command.newPurchaseOrder"), href: "/purchase/orders/new" },
    { label: t("command.addCustomer"),      href: "/crm/customers/new" },
    { label: t("command.newQuotation"),     href: "/sales/quotations/new" },
  ], [t]);

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


