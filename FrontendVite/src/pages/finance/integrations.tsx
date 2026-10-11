import { useTranslation } from "react-i18next";
import { Can } from "@/components/auth/can";
import { IntegrationsView } from "@/modules/finance/integrations/components/integrations-view";

export default function Page() {
  const { t } = useTranslation("finance");
  return (
    <Can
      permission="finance.integrations.view"
      fallback={<div className="p-10 text-center text-sm text-muted-foreground">{t("integrations.noAccess")}</div>}
    >
      <IntegrationsView />
    </Can>
  );
}
