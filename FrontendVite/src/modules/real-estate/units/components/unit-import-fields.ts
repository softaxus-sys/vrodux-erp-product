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
    synonyms: ["unitnumber", "unit", "unitno", "flat", "flatno", "apartment", "apartmentno", "number"] },
  { key: "propertyName", label: "Property",
    synonyms: ["property", "propertyname", "building", "buildingname", "project", "tower", "propertynumber"] },
  { key: "unitType",     label: "Unit type",
    synonyms: ["type", "unittype", "category", "layout", "configuration"] },
  { key: "area",         label: "Area",
    numeric: true,
    synonyms: ["area", "size", "sqft", "squarefeet", "builtuparea", "bua"] },
  { key: "floor",        label: "Floor",
    numeric: true,
    synonyms: ["floor", "level", "floorno", "storey"] },
  { key: "rentPerYear",  label: "Annual rent",
    numeric: true,
    synonyms: ["rent", "rentperyear", "annualrent", "yearlyrent", "rentpa", "rentalprice"] },
  { key: "salePrice",    label: "Sale price",
    numeric: true,
    synonyms: ["saleprice", "price", "sellingprice", "askingprice"] },
  { key: "furnishing",   label: "Furnishing",
    synonyms: ["furnishing", "furnished", "furnishingstatus"] },
  { key: "view",         label: "View",
    synonyms: ["view", "outlook", "facing"] },
  { key: "bedrooms",     label: "Bedrooms",
    numeric: true,
    synonyms: ["bedrooms", "beds", "bed", "br", "bhk", "noofbedrooms"] },
  { key: "bathrooms",    label: "Bathrooms",
    numeric: true,
    synonyms: ["bathrooms", "baths", "bath", "ba", "noofbathrooms"] },
  { key: "parking",      label: "Parking spaces",
    numeric: true,
    synonyms: ["parking", "parkingspaces", "carpark", "parkingslots"] },
  { key: "serviceCharge", label: "Service charge",
    numeric: true,
    synonyms: ["servicecharge", "servicecharges", "maintenance", "maintenancefee"] },
  { key: "notes",        label: "Notes",
    synonyms: ["notes", "remarks", "comment", "description", "details"] },
];
