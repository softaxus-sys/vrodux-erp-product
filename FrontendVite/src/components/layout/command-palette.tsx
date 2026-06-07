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
import { navigationConfig } from "@/config/navigation";

const flattenNavItems = () => {
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
};

const allNavItems = flattenNavItems();

const quickActions = [
  { label: "Create Invoice", href: "/finance/invoicing/new" },
  { label: "Add Employee", href: "/hr/employees/new" },
  { label: "New Purchase Order", href: "/purchase/orders/new" },
  { label: "Add Customer", href: "/crm/customers/new" },
  { label: "New Quotation", href: "/sales/quotations/new" },
];

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const navigate = useNavigate();

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
      <CommandInput placeholder="Search modules, records, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => (
            <CommandItem key={action.href} onSelect={() => run(action.href)}>
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
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


