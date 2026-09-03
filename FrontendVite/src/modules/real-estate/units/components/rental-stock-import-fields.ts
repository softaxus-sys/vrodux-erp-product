import type { ImportField } from "@/components/ui/spreadsheet-import-modal";

/**
 * Columns of an agency rental-stock sheet — one row per apartment being marketed.
 *
 * Different from the plain unit import: the building is created from its name rather than looked up,
 * and the values are written for people. Nothing here is marked `numeric`, because these columns are
 * not numbers: rent arrives as "48K/2CQ.", beds as "2bhk+maids", area as "1968SQFT.". The server
 * parses them, so the raw text has to reach it intact.
 */
export type RentalStockField =
  | "building" | "location" | "propertyType" | "unitNumber"
  | "beds" | "price" | "area" | "furnishing" | "occupancy" | "view"
  | "ownerName" | "ownerPhone" | "agent";

export const RENTAL_STOCK_FIELDS: ImportField<RentalStockField>[] = [
  { key: "building",     label: "Building / project", required: true,
    synonyms: ["building", "buildingname", "project", "tower", "property", "propertyname"] },
  { key: "location",     label: "Location / community",
    synonyms: ["location", "area", "community", "city", "district"] },
  { key: "propertyType", label: "Type (apartment / villa)",
    synonyms: ["type", "propertytype", "unittype", "category"] },
  { key: "unitNumber",   label: "Unit number",
    synonyms: ["unit", "unitno", "unitnumber", "flat", "flatno", "apartmentno"] },
  { key: "beds",         label: "Bedrooms (3BHK, Studio)",
    synonyms: ["beds", "bed", "bedrooms", "bhk", "layout", "configuration"] },
  { key: "price",        label: "Rent (200K, 48K/2CQ.)",
    synonyms: ["price", "rent", "priceaed", "rentaed", "annualrent", "rentprice", "amount"] },
  { key: "area",         label: "Area (1968SQFT.)",
    synonyms: ["area", "sqft", "areasqft", "size", "builtuparea", "bua"] },
  { key: "furnishing",   label: "Furnishing",
    synonyms: ["furnished", "furnishing", "furnishedfitted", "fitted"] },
  { key: "occupancy",    label: "Vacant / tenanted",
    synonyms: ["vacant", "tenanted", "vacanttenanted", "occupancy", "status"] },
  { key: "view",         label: "View",
    synonyms: ["view", "outlook", "facing"] },
  { key: "ownerName",    label: "Owner name",
    synonyms: ["owner", "ownername", "ownersnames", "landlord"] },
  { key: "ownerPhone",   label: "Owner contact",
    synonyms: ["numbers", "ownernumber", "contact", "phone", "mobile", "ownercontact"] },
  { key: "agent",        label: "Agent / assignee",
    synonyms: ["assignee", "agent", "listedby", "handledby", "consultant"] },
];
