import * as React from "react";
import { Languages, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * UI-language picker. Shown in the topbar. Changing the language flips the whole
 * app (including RTL) and persists the choice per-user.
 */
export function LanguageSwitcher({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const { t } = useTranslation("common");
  const { language, meta, languages, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "full" ? (
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs">{meta.nativeName}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            aria-label={t("language.select")}
            title={t("language.label")}
          >
            <Languages className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("language.select")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((lng) => {
          const active = lng.code === language;
          return (
            <DropdownMenuItem
              key={lng.code}
              onClick={() => setLanguage(lng.code)}
              className={cn("flex items-center justify-between gap-2", active && "font-semibold")}
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded bg-muted px-1 text-[10px] font-bold uppercase text-muted-foreground">
                  {lng.short}
                </span>
                <span dir={lng.dir}>{lng.nativeName}</span>
              </span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
