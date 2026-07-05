import * as React from "react";
import {
  LayoutDashboard, Sparkles, BarChart3, FolderOpen,
  DollarSign, BookOpen, Layers, FileText, Receipt,
  CreditCard, PieChart, Percent, Landmark,
  Users, UserCheck, Clock, Banknote, CalendarOff, UserPlus, TrendingUp,
  Handshake, UserSearch, Workflow, Building2,
  ShoppingBag, FileSearch, ClipboardList, RotateCcw,
  ShoppingCart, Truck, ClipboardCheck, CheckCircle2,
  Package, PackageCheck, Warehouse, Boxes, ArrowLeftRight,
  Building, Home, DoorOpen, FileSignature,
  HardHat, FolderKanban, ListChecks, Hammer, MapPin,
  Hotel, CalendarCheck, BedDouble, SprayCan,
  Monitor, UtensilsCrossed, ChefHat,
  Settings2, SlidersHorizontal, ShieldCheck, GitBranch, Plug, ScrollText,
  Zap, Bell, FolderTree, Tag, Ruler, Ticket, Repeat, Activity, Briefcase,
  PanelLeft, PanelRight, PanelTop, LayoutGrid, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Sparkles, BarChart3, FolderOpen,
  DollarSign, BookOpen, Layers, FileText, Receipt,
  CreditCard, PieChart, Percent, Landmark,
  Users, UserCheck, Clock, Banknote, CalendarOff, UserPlus, TrendingUp,
  Handshake, UserSearch, Workflow, Building2,
  ShoppingBag, FileSearch, ClipboardList, RotateCcw,
  ShoppingCart, Truck, ClipboardCheck, CheckCircle2,
  Package, PackageCheck, Warehouse, Boxes, ArrowLeftRight,
  Building, Home, DoorOpen, FileSignature,
  HardHat, FolderKanban, ListChecks, Hammer, MapPin,
  Hotel, CalendarCheck, BedDouble, SprayCan,
  Monitor, UtensilsCrossed, ChefHat,
  Settings2, SlidersHorizontal, ShieldCheck, GitBranch, Plug, ScrollText,
  Zap, Bell, FolderTree, Tag, Ruler, Ticket, Repeat, Activity, Briefcase,
  PanelLeft, PanelRight, PanelTop, LayoutGrid, Coins,
};

export function NavIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function NavBadge({ badge, variant }: { badge?: string | number; variant?: string }) {
  if (!badge && badge !== 0) return null;
  const cls = ({
    default:     "bg-primary/10 text-primary",
    success:     "bg-success/10 text-success",
    warning:     "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  })[variant ?? "default"] ?? "bg-primary/10 text-primary";

  return (
    <span className={cn("ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none", cls)}>
      {badge}
    </span>
  );
}
