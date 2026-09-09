import type { ImportField } from "@/components/ui/spreadsheet-import-modal";

/**
 * Columns the property importer understands, and the headings that auto-map to each.
 *
 * Only the name is required. A portfolio handover usually arrives as a list of buildings with the
 * valuations and areas following later, so demanding more would make the importer useless for the
 * one case it exists for.
 *
 * Unit counts are deliberately absent: they are recomputed from the real unit rows whenever units
 * are added, so a number typed in a spreadsheet would only be overwritten.
 */
export type PropertyImportField =
  | "name" | "propertyType" | "address" | "city" | "emirate"
  | "totalArea" | "marketValue" | "developer" | "description";

export const PROPERTY_IMPORT_FIELDS: ImportField<PropertyImportField>[] = [
  { key: "name",         label: "Property name",  required: true,
    sample: "Marina Heights Tower",
    synonyms: ["name", "propertyname", "building", "buildingname", "project", "projectname", "tower"] },
  { key: "propertyType", label: "Property type",
    sample: "Residential",
    synonyms: ["type", "propertytype", "category", "buildingtype", "assettype"] },
  { key: "address",      label: "Address",
    sample: "Plot 42, Dubai Marina",
    synonyms: ["address", "street", "location", "addressline1", "address1"] },
  { key: "city",         label: "City",
    sample: "Dubai",
    synonyms: ["city", "town", "area", "community"] },
  { key: "emirate",      label: "Emirate / region",
    sample: "Dubai",
    synonyms: ["emirate", "region", "state", "province"] },
  { key: "totalArea",    label: "Total area",
    numeric: true,
    sample: "48500",
    synonyms: ["area", "totalarea", "size", "builtuparea", "bua", "sqft", "squarefeet"] },
  { key: "marketValue",  label: "Market value",
    numeric: true,
    sample: "32000000",
    synonyms: ["marketvalue", "value", "valuation", "price", "assetvalue", "worth"] },
  { key: "developer",    label: "Developer",
    sample: "Emaar Properties",
    synonyms: ["developer", "builder", "owner", "developedby"] },
  { key: "description",  label: "Description",
    sample: "38-floor residential tower, handover 2024",
    synonyms: ["description", "notes", "remarks", "comment", "details"] },
];
