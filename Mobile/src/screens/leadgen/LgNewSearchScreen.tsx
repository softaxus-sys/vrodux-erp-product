import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLgCreateSearch, useLgEstimate, useLgMeta } from "@/hooks/use-leadgen";
import type { SearchInput } from "@/lib/leadgen.api";
import { ChipField, Field, FormScreen, Section, SubmitBar, TextField, errorMessage, fieldError } from "@/components/forms/FormKit";
import { Button, Chip, ErrorState, LoadingState } from "@/components/ui";
import { fontSize, spacing, useAppTheme, type AppColors } from "@/theme";
import type { LeadGenStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LeadGenStackParamList, "LgNewSearch">;

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function LgNewSearchScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const meta = useLgMeta();
  const estimate = useLgEstimate();
  const create = useLgCreateSearch();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catQuery, setCatQuery] = useState("");
  const [keywords, setKeywords] = useState("");
  const [maxResults, setMaxResults] = useState("50");

  if (meta.isLoading) return <LoadingState />;
  if (meta.isError || !meta.data) return <ErrorState message="Could not load search options." onRetry={() => meta.refetch()} />;
  const m = meta.data;

  if (!m.enabled) return <ErrorState message="Lead Generation is switched off for the platform." />;

  const liveCountries = m.countries.filter((c) => c.live && c.allowed);
  const countryCode = country || m.defaultCountry || liveCountries[0]?.code || "";
  const regionList = m.countries.find((c) => c.code === countryCode)?.regions ?? [];
  const max = Math.min(Number(maxResults) || 0, m.limits.maxResultsPerSearch);
  const cats = m.categories.filter((c) => !catQuery.trim() || c.label.toLowerCase().includes(catQuery.trim().toLowerCase())).slice(0, 24);
  const selectedCats = m.categories.filter((c) => categories.includes(c.key));

  const body: SearchInput = {
    name: name.trim(), countryCode, regions, categories, keywords: keywords.trim() || null, maxResults: max,
  };
  const valid = body.name.length > 0 && categories.length > 0 && max > 0;

  return (
    <FormScreen>
      <Section title="What are you looking for?">
        <TextField label="Search name" required value={name} onChangeText={setName} placeholder="e.g. Dental clinics in Dubai" error={fieldError(create.error, "name")} />
        {liveCountries.length > 1 ? (
          <ChipField label="Country" value={countryCode} onChange={(v) => { setCountry(v); setRegions([]); }} options={liveCountries.map((c) => ({ value: c.code, label: c.name }))} />
        ) : null}
        {regionList.length > 0 ? (
          <Field label="Regions (leave empty for the whole country)">
            <View style={styles.chips}>
              {regionList.map((r) => <Chip key={r.name} label={r.name} active={regions.includes(r.name)} onPress={() => setRegions((p) => toggle(p, r.name))} />)}
            </View>
          </Field>
        ) : null}
        <Field label="Business categories" required>
          {selectedCats.length > 0 ? (
            <View style={styles.chips}>
              {selectedCats.map((c) => <Chip key={c.key} label={`${c.label} ✕`} active onPress={() => setCategories((p) => toggle(p, c.key))} />)}
            </View>
          ) : null}
          <TextField label="Find a category" value={catQuery} onChangeText={setCatQuery} placeholder="Type to filter…" />
          <View style={styles.chips}>
            {cats.map((c) => <Chip key={c.key} label={c.label} active={categories.includes(c.key)} onPress={() => setCategories((p) => toggle(p, c.key))} />)}
          </View>
        </Field>
        <TextField label="Extra keywords (optional)" value={keywords} onChangeText={setKeywords} placeholder="e.g. 24 hour, emergency" />
        <TextField
          label="How many results"
          value={maxResults}
          onChangeText={setMaxResults}
          keyboardType="number-pad"
          hint={`Up to ${m.limits.maxResultsPerSearch} per search. ${m.limits.searchesToday}/${m.limits.dailySearchLimit} searches used today.`}
        />
      </Section>

      <View style={styles.estimateBox}>
        <Button
          label={estimate.isPending ? "Checking…" : "Check before running"}
          variant="outline"
          icon="activity"
          disabled={!valid || estimate.isPending}
          onPress={() => estimate.mutate(body)}
        />
        {estimate.data ? (
          <View style={{ gap: 2 }}>
            <Text style={styles.note}>
              About {estimate.data.plannedQueries} lookups · {estimate.data.searchesLeftToday} searches and {estimate.data.discoveryLeftToday} new businesses left today.
            </Text>
            {estimate.data.warnings.map((w, i) => <Text key={i} style={styles.warn}>• {w}</Text>)}
            {!estimate.data.providerConfigured ? <Text style={styles.warn}>The search provider isn't configured yet.</Text> : null}
          </View>
        ) : null}
        {estimate.isError ? <Text style={styles.warn}>{errorMessage(estimate.error, "Could not check.")}</Text> : null}
      </View>

      <Text style={styles.note}>Finding businesses is free. You only spend credits when you reveal a contact.</Text>
      <SubmitBar
        label="Run search"
        disabled={!valid}
        loading={create.isPending}
        error={errorMessage(create.error, "Could not start the search.")}
        onPress={() => create.mutate(body, { onSuccess: () => navigation.goBack() })}
      />
    </FormScreen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    estimateBox: { gap: spacing.sm },
    note: { fontSize: fontSize.sm, color: colors.mutedForeground },
    warn: { fontSize: fontSize.sm, color: colors.warning },
  });
}
