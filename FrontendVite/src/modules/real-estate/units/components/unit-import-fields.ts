import type { ImportField } from "@/components/ui/spreadsheet-import-modal";

/**
 * Columns the unit importer understands.
 *
 * The unit number is the only required field. The property is matched by name (or by our own
 * property number, so an export from this system re-imports cleanly) — a row naming a building that
 * does not exist is reported by name rather than dropped, because that is a typo someone can fix.
 *
 * When the sheet is imported from inside a single property, the Property column is unnecessary and
 * the importer scopes every row to that building instead.
 */
export type UnitImportField =
  | "unitNumber" | "propertyName" | "unitType" | "area" | "floor"
  | "rentPerYear" | "salePrice" | "furnishing" | "view"
  | "bedrooms" | "bathrooms" | "parking" | "serviceCharge" | "notes";

export const UNIT_IMPORT_FIELDS: ImportField<UnitImportField>[] = [
  { key: "unitNumber",   label: "Unit number", required: true,
    sample: "1204",
    synonyms: ["unitnumber", "unit", "unitno", "flat", "flatno", "apartment", "apartmentno", "number"] },
  { key: "propertyName", label: "Property",
    sample: "Marina Heights Tower",
    synonyms: ["property", "propertyname", "building", "buildingname", "project", "tower", "propertynumber"] },
  { key: "unitType",     label: "Unit type",
    sample: "Apartment",
    synonyms: ["type", "unittype", "category", "layout", "configuration"] },
  { key: "area",         label: "Area",
    numeric: true,
    sample: "1250",
    synonyms: ["area", "size", "sqft", "squarefeet", "builtuparea", "bua"] },
  { key: "floor",        label: "Floor",
    numeric: true,
    sample: "12",
    synonyms: ["floor", "level", "floorno", "storey"] },
  { key: "rentPerYear",  label: "Annual rent",
    numeric: true,
    sample: "95000",
    synonyms: ["rent", "rentperyear", "annualrent", "yearlyrent", "rentpa", "rentalprice"] },
  { key: "salePrice",    label: "Sale price",
    numeric: true,
    sample: "1450000",
    synonyms: ["saleprice", "price", "sellingprice", "askingprice"] },
  { key: "furnishing",   label: "Furnishing",
    sample: "Furnished",
    synonyms: ["furnishing", "furnished", "furnishingstatus"] },
  { key: "view",         label: "View",
    sample: "Sea view",
    synonyms: ["view", "outlook", "facing"] },
  { key: "bedrooms",     label: "Bedrooms",
    numeric: true,
    sample: "2",
    synonyms: ["bedrooms", "beds", "bed", "br", "bhk", "noofbedrooms"] },
  { key: "bathrooms",    label: "Bathrooms",
    numeric: true,
    sample: "2",
    synonyms: ["bathrooms", "baths", "bath", "ba", "noofbathrooms"] },
  { key: "parking",      label: "Parking spaces",
    numeric: true,
    sample: "1",
    synonyms: ["parking", "parkingspaces", "carpark", "parkingslots"] },
  { key: "serviceCharge", label: "Service charge",
    numeric: true,
    sample: "14500",
    synonyms: ["servicecharge", "servicecharges", "maintenance", "maintenancefee"] },
  { key: "notes",        label: "Notes",
    sample: "Corner unit, balcony",
    synonyms: ["notes", "remarks", "comment", "description", "details"] },
];
