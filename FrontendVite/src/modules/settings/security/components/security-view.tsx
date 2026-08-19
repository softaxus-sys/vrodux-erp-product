import { useTranslation } from "react-i18next";
import { TwoFactorCard } from "./two-factor-card";

export function SecurityView() {
  const { t } = useTranslation("settings");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("security.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("security.description")}
        </p>
      </div>
      <div className="max-w-2xl">
        <TwoFactorCard />
      </div>
    </div>
  );
}
