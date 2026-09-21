import type { ImportField } from "@/components/ui/spreadsheet-import-modal";

/**
 * Every column of an agency stock sheet — one row per unit being marketed.
 *
 * <p>Nothing here is marked `numeric`. These columns are not numbers: a price arrives as
 * "700k(rented till 29 feb 2026 in 55k)", beds as "2bhk+maid", area as "plot area 1225.47sqft,
 * built up area 2234.35sqft". The server parses a figure out of each and keeps the raw cell
 * beside it, so the text has to reach it intact — cleaning it here would throw away the
 * condition the deal was actually agreed on.</p>
 *
 * <p>Synonyms are matched against the header with punctuation and spaces stripped, which is why
 * they are written closed-up. They cover the real headers seen in these files, including the
 * ones that read oddly ("Pictures/Vadio", "listed By/permit no").</p>
 */
export type ListingImportField =
  | "purpose" | "propertyType" | "category" | "listedOn"
  | "building" | "unitNumber" | "location"
  | "beds" | "price" | "area"
  | "pictures" | "furnishing" | "listing" | "listedBy"
  | "agent" | "ownerName" | "ownerPhone" | "ownerPhoneAlt";

export const LISTING_IMPORT_FIELDS: ImportField<ListingImportField>[] = [
  { key: "building", label: "Building / project", required: true,
    sample: "Cayan Tower",
    synonyms: ["building", "buildingname", "project", "tower", "property", "propertyname"] },

  { key: "unitNumber", label: "Unit number",
    sample: "1206",
    synonyms: ["unit", "unitno", "unitnumber", "flat", "flatno", "apartmentno", "doorno"] },

  { key: "location", label: "Location / community",
    sample: "Dubai Marina",
    synonyms: ["location", "area", "community", "district", "city"] },

  // Decides whether the price is an annual rent or an asking price, so it is worth mapping even
  // when a file is all one or the other.
  { key: "purpose", label: "Purpose (rent / sale)",
    sample: "Rent",
    synonyms: ["purpose", "for", "type1", "listingtype", "offer", "offertype", "rentsale", "transactiontype"] },

  { key: "propertyType", label: "Type (apartment / villa / plot)",
    sample: "Apartment",
    synonyms: ["type", "propertytype", "unittype", "proptype"] },

  { key: "category", label: "Category (residential / commercial)",
    sample: "Residential",
    synonyms: ["category", "residentialcommercial", "segment", "usage", "class"] },

  { key: "listedOn", label: "Date listed",
    sample: "19-Sep-25",
    synonyms: ["month", "date", "datelisted", "listedon", "listingdate", "addedon", "day"] },

  { key: "beds", label: "Bedrooms (1BHK, studio, 2bhk+maid)",
    sample: "2BHK",
    synonyms: ["beds", "bed", "bedrooms", "bhk", "layout", "configuration", "rooms"] },

  { key: "price", label: "Price (700k, 135k, 3.25M)",
    sample: "135k",
    synonyms: ["price", "priceaed", "rent", "rentaed", "annualrent", "amount", "askingprice", "sellingprice"] },

  { key: "area", label: "Area (699sqft)",
    sample: "713.54sqft",
    synonyms: ["area", "sqft", "areasqft", "size", "builtuparea", "bua", "plotarea"] },

  { key: "pictures", label: "Photos / video on file (yes / no)",
    sample: "yes",
    // "Vadio" is how the column is actually spelled in these sheets.
    synonyms: ["pictures", "picturesvadio", "picturesvideo", "photos", "media", "images", "pics"] },

  { key: "furnishing", label: "Furnishing",
    sample: "Furnished",
    synonyms: ["furnished", "furnishing", "furnishedfitted", "fitted"] },

  { key: "listing", label: "Advertised on a portal (yes / no)",
    sample: "no",
    synonyms: ["listing", "listed", "advertised", "portal", "published"] },

  // Listed separately from the agent: this column holds who advertised it and under which permit,
  // which is not the same person as the one handling enquiries.
  { key: "listedBy", label: "Listed by / permit no.",
    sample: "zaryab / 7126390600",
    synonyms: ["listedby", "listedbypermitno", "permit", "permitno", "advertisedby", "trakheesi"] },

  { key: "agent", label: "Agent (contact with)",
    sample: "Nida",
    synonyms: ["contactwith", "agent", "assignee", "handledby", "consultant", "contact"] },

  { key: "ownerName", label: "Owner name",
    sample: "Majid",
    synonyms: ["owner", "ownername", "ownersnames", "ownersname", "landlord"] },

  { key: "ownerPhone", label: "Owner contact",
    sample: "545556075",
    synonyms: ["numbers", "number", "ownernumber", "phone", "mobile", "ownercontact", "contactno"] },

  // These sheets routinely carry a second number in an unlabelled column. Mapping it is what stops
  // the only reachable line for an owner being dropped.
  { key: "ownerPhoneAlt", label: "Owner contact (second number)",
    sample: "509040075",
    synonyms: ["numbers2", "number2", "altnumber", "alternatenumber", "secondnumber", "mobile2", "phone2"] },
];
