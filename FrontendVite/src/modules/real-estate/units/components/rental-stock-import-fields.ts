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
    sample: "Marina Heights Tower",
    synonyms: ["building", "buildingname", "project", "tower", "property", "propertyname"] },
  { key: "location",     label: "Location / community",
    sample: "Dubai Marina",
    synonyms: ["location", "area", "community", "city", "district"] },
  { key: "propertyType", label: "Type (apartment / villa)",
    sample: "Apartment",
    synonyms: ["type", "propertytype", "unittype", "category"] },
  { key: "unitNumber",   label: "Unit number",
    sample: "1204",
    synonyms: ["unit", "unitno", "unitnumber", "flat", "flatno", "apartmentno"] },
  { key: "beds",         label: "Bedrooms (3BHK, Studio)",
    sample: "2BHK",
    synonyms: ["beds", "bed", "bedrooms", "bhk", "layout", "configuration"] },
  { key: "price",        label: "Rent (200K, 48K/2CQ.)",
    sample: "95K",
    synonyms: ["price", "rent", "priceaed", "rentaed", "annualrent", "rentprice", "amount"] },
  { key: "area",         label: "Area (1968SQFT.)",
    sample: "1250SQFT.",
    synonyms: ["area", "sqft", "areasqft", "size", "builtuparea", "bua"] },
  { key: "furnishing",   label: "Furnishing",
    sample: "Furnished",
    synonyms: ["furnished", "furnishing", "furnishedfitted", "fitted"] },
  { key: "occupancy",    label: "Vacant / tenanted",
    sample: "Vacant",
    synonyms: ["vacant", "tenanted", "vacanttenanted", "occupancy", "status"] },
  { key: "view",         label: "View",
    sample: "Sea view",
    synonyms: ["view", "outlook", "facing"] },
  { key: "ownerName",    label: "Owner name",
    sample: "Ahmed Al Mansouri",
    synonyms: ["owner", "ownername", "ownersnames", "landlord"] },
  { key: "ownerPhone",   label: "Owner contact",
    sample: "+971 50 123 4567",
    synonyms: ["numbers", "ownernumber", "contact", "phone", "mobile", "ownercontact"] },
  { key: "agent",        label: "Agent / assignee",
    sample: "Sara Khan",
    synonyms: ["assignee", "agent", "listedby", "handledby", "consultant"] },
];
