import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { usePropertiesPaged } from "@/hooks/use-real-estate";
import {
  ChipField, FormScreen, NumberField, PickerField, Section, SubmitBar, SwitchField, TextField, errorMessage, fieldError, toNumber, type PickOption,
} from "@/components/forms/FormKit";
import type { RealEstateStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RealEstateStackParamList, "NewListing">;

const PURPOSES = [{ value: "rent", label: "For rent" }, { value: "sale", label: "For sale" }];
const STATUSES = [{ value: "vacant", label: "Vacant" }, { value: "rented", label: "Rented" }, { value: "reserved", label: "Reserved" }];
const FURNISHING = [{ value: "unfurnished", label: "Unfurnished" }, { value: "semi_furnished", label: "Semi" }, { value: "furnished", label: "Furnished" }];

/** One apartment = one listing: names the building (existing or new) and the unit together. */
export default function NewListingScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const props = usePropertiesPaged({ pageSize: 200 });
  const create = useMutation({
    mutationFn: (body: unknown) => apiClient.post("/api/real-estate/listings", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["real-estate"] }),
  });

  const [building, setBuilding] = useState<PickOption | null>(null);
  const [newName, setNewName] = useState("");
  const [city, setCity] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [unitType, setUnitType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [area, setArea] = useState("");
  const [purpose, setPurpose] = useState("rent");
  const [status, setStatus] = useState("vacant");
  const [furnishing, setFurnishing] = useState("unfurnished");
  const [price, setPrice] = useState("");
  const [listed, setListed] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [notes, setNotes] = useState("");

  const options: PickOption[] = (props.data?.items ?? []).map((p) => ({ id: p.id, label: p.name, sub: p.propertyNumber }));
  const amount = toNumber(price || "0");
  const canSubmit = (building !== null || newName.trim().length > 0) && !Number.isNaN(amount) && amount >= 0;

  function submit() {
    const isSale = purpose === "sale";
    create.mutate(
      {
        propertyId: building?.id ?? null, propertyName: building ? null : newName.trim(), propertyType: unitType.trim() || null,
        category: null, address: null, city: city.trim() || null, emirate: null, developer: null, propertyDescription: null, propertyMarketValue: 0,
        unitNumber: unitNo.trim() || null, unitType: unitType.trim() || null, area: toNumber(area || "0") || 0, floor: 0,
        rentPerYear: isSale ? 0 : amount, salePrice: isSale ? amount : 0, status, furnishing,
        view: null, bedrooms: beds ? Math.round(toNumber(beds)) : null, bathrooms: baths ? Math.round(toNumber(baths)) : null,
        parking: 0, serviceCharge: 0, notes: notes.trim() || null,
        purpose, listedOn: null, bedsLabel: null, priceLabel: null, areaLabel: null, hasMedia: false, isListed: listed,
        listedBy: null, agentName: null, agentUserId: null, restrictConfidentialDetails: true,
        ownerName: ownerName.trim() || null, ownerPhone: ownerPhone.trim() || null, ownerPhoneAlt: null, rentedUntil: null,
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <FormScreen>
      <Section title="Building">
        <PickerField label="Existing building" value={building} onChange={setBuilding} options={options} loading={props.isLoading} />
        {building === null ? (
          <>
            <TextField label="Or new building name" value={newName} onChangeText={setNewName} autoCapitalize="words" error={fieldError(create.error, "propertyName")} />
            <TextField label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
          </>
        ) : null}
      </Section>
      <Section title="Unit">
        <TextField label="Unit number" value={unitNo} onChangeText={setUnitNo} hint="Left blank, one is generated." />
        <TextField label="Type" value={unitType} onChangeText={setUnitType} placeholder="Apartment, Villa, Office" autoCapitalize="words" />
        <NumberField label="Bedrooms" value={beds} onChangeText={setBeds} />
        <NumberField label="Bathrooms" value={baths} onChangeText={setBaths} />
        <NumberField label="Area" value={area} onChangeText={setArea} />
        <ChipField label="Furnishing" value={furnishing} onChange={setFurnishing} options={FURNISHING} />
      </Section>
      <Section title="Listing">
        <ChipField label="Purpose" value={purpose} onChange={setPurpose} options={PURPOSES} />
        <NumberField label={purpose === "sale" ? "Asking price" : "Rent per year"} value={price} onChangeText={setPrice} />
        <ChipField label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <SwitchField label="Listed" value={listed} onChange={setListed} />
        <TextField label="Owner name" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" />
        <TextField label="Owner phone" value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <SubmitBar label="Add listing" onPress={submit} disabled={!canSubmit} loading={create.isPending} error={errorMessage(create.error)} />
    </FormScreen>
  );
}
