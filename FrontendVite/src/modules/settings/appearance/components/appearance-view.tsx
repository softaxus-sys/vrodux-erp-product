import * as React from "react";
import { motion } from "framer-motion";
import { PanelLeft, PanelRight, PanelTop, LayoutGrid, Check, Sun, Moon, Palette, Layout, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme.store";
import { THEME_PALETTES, LAYOUT_OPTIONS, type LayoutVariant } from "@/config/themes";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { appSettingsApi } from "@/lib/identity/app-settings.api";

const layoutIcons: Record<string, React.ReactNode> = {
  PanelLeft:  <PanelLeft  className="h-5 w-5" />,
  PanelRight: <PanelRight className="h-5 w-5" />,
  PanelTop:   <PanelTop   className="h-5 w-5" />,
  LayoutGrid: <LayoutGrid className="h-5 w-5" />,
};

export function AppearanceView() {
  const { paletteId, layoutVariant, darkMode, radius, setPalette, setLayoutVariant, setDarkMode, setRadius } = useThemeStore();
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await appSettingsApi.saveCategory("appearance", {
        paletteId,
        layoutVariant,
        darkMode:  String(darkMode),
        radius:    String(radius),
      });
      toast.success("Appearance saved.");
    } catch {
      toast.error("Failed to save appearance.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Appearance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the look and feel of Vrodux. Changes are saved to your profile.
        </p>
      </div>

      {/* Color Palette */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Color Palette</h2>
            <p className="text-xs text-muted-foreground">Choose a brand color for the sidebar and primary actions</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {THEME_PALETTES.map((palette) => {
            const active = paletteId === palette.id;
            return (
              <motion.button key={palette.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setPalette(palette.id)}
                className={cn("relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center",
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/30")}>
                <div className="h-10 w-10 rounded-full shadow-inner border border-black/10 flex items-center justify-center"
                  style={{ background: palette.preview }}>
                  {active && <Check className="h-4 w-4 text-white drop-shadow" />}
                </div>
                <span className="text-xs font-medium leading-tight">{palette.name}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Layout Variant */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layout className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Navigation Layout</h2>
            <p className="text-xs text-muted-foreground">Choose how the navigation menu is displayed</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LAYOUT_OPTIONS.map((opt) => {
            const active = layoutVariant === opt.id;
            return (
              <motion.button key={opt.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setLayoutVariant(opt.id as LayoutVariant)}
                className={cn("flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-center",
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/30")}>
                <div className={cn("h-14 w-20 rounded-lg border-2 overflow-hidden bg-muted/50 relative",
                  active ? "border-primary/40" : "border-border/60")}>
                  {opt.id === "sidebar-left"  && <><div className="absolute left-0 top-0 bottom-0 w-5 bg-primary/30 rounded-l" /><div className="absolute left-6 top-1.5 right-1.5 h-2 bg-muted-foreground/20 rounded" /></>}
                  {opt.id === "sidebar-right" && <><div className="absolute right-0 top-0 bottom-0 w-5 bg-primary/30 rounded-r" /><div className="absolute left-1.5 top-1.5 right-6 h-2 bg-muted-foreground/20 rounded" /></>}
                  {opt.id === "top-nav"       && <><div className="absolute left-0 right-0 top-0 h-3.5 bg-primary/30" /><div className="absolute left-1.5 top-5 right-1.5 bottom-1.5 bg-muted-foreground/10 rounded" /></>}
                  {opt.id === "mini-rail"     && <><div className="absolute left-0 top-0 bottom-0 w-3 bg-primary/30 rounded-l" /><div className="absolute left-4 top-1.5 right-1.5 h-2 bg-muted-foreground/20 rounded" /></>}
                </div>
                <div className="flex items-center gap-1.5">
                  {layoutIcons[opt.icon]}
                  <span className="text-xs font-medium">{opt.name}</span>
                  {active && <Check className="h-3 w-3 text-primary ml-0.5" />}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{opt.description}</p>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Dark Mode */}
      <section>
        <h2 className="text-sm font-semibold mb-4">Color Mode</h2>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {[{ mode: false, label: "Light", icon: <Sun className="h-5 w-5" /> }, { mode: true, label: "Dark", icon: <Moon className="h-5 w-5" /> }].map(({ mode, label, icon }) => (
            <motion.button key={label} whileTap={{ scale: 0.97 }} onClick={() => setDarkMode(mode)}
              className={cn("flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all",
                darkMode === mode ? "border-primary bg-primary/5 text-primary font-medium" : "border-border bg-card text-muted-foreground")}>
              {icon}
              <span className="text-sm">{label}</span>
              {darkMode === mode && <Check className="h-3.5 w-3.5 ml-auto" />}
            </motion.button>
          ))}
        </div>
      </section>

      {/* Border Radius */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Corner Radius</h2>
            <p className="text-xs text-muted-foreground">Roundness of cards, buttons, and inputs</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{radius}rem</span>
        </div>
        <div className="max-w-sm">
          <Slider min={0} max={1.2} step={0.1} value={[radius]} onValueChange={([v]: number[]) => setRadius(v)} className="w-full" />
          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground"><span>Sharp</span><span>Rounded</span><span>Pill</span></div>
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
