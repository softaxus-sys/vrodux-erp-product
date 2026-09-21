import type { ImportField } from "@/components/ui/spreadsheet-import-modal";

/**
 * Every column of an agency stock sheet — one row per unit being marketed.
 *
 * <p><b>Ordered and headed to match the sheets agencies already keep</b>, so a downloaded template
 * is a drop-in replacement for the file on their desktop rather than something to transcribe into.
 * `templateHeader` carries the source wording ("Pictures/Vadio", "listed By/permit no") while
 * `label` stays readable in the mapping dropdown.</p>
 *
 * <p>Nothing here is marked `numeric`. These columns are not numbers: a price arrives as
 * "700k(rented till 29 feb 2026 in 55k)", beds as "2bhk+maid", area as "plot area 1225.47sqft,
 * built up area 2234.35sqft". The server parses a figure out of each and keeps the raw cell
 * beside it, so the text has to reach it intact — cleaning it here would throw away the
 * condition the deal was actually agreed on.</p>
 *
 * <p>Synonyms are matched against the header with punctuation and spaces stripped, which is why
 * they are written closed-up.</p>
 */
export type ListingImportField =
  | "listedOn" | "purpose" | "propertyType" | "category"
  | "unitNumber" | "building" | "location"
  | "beds" | "price" | "area"
  | "pictures" | "furnishing" | "listing" | "listedBy"
  | "agent" | "ownerName" | "ownerPhone" | "ownerPhoneAlt";

export const LISTING_IMPORT_FIELDS: ImportField<ListingImportField>[] = [
  { key: "listedOn", label: "Date listed", templateHeader: "Month",
    sample: "19-Sep-25",
    synonyms: ["month", "date", "datelisted", "listedon", "listingdate", "addedon", "day"] },

  // Decides whether the price is an annual rent or an asking price, so it is worth mapping even
  // when a file is all one or the other.
  { key: "purpose", label: "Purpose (rent / sale)", templateHeader: "Purpose",
    sample: "Rent",
    synonyms: ["purpose", "for", "type1", "listingtype", "offer", "offertype", "rentsale", "transactiontype"] },

  { key: "propertyType", label: "Type (apartment / villa / plot)", templateHeader: "Type",
    sample: "apartment",
    synonyms: ["type", "propertytype", "unittype", "proptype"] },

  // Unheaded in the source sheets — the column sits between Type and unit holding "Residential".
  // Naming it here is what lets a saved copy auto-map instead of needing a hand-pick every time.
  { key: "category", label: "Category (residential / commercial)", templateHeader: "Category",
    sample: "Residential",
    synonyms: ["category", "residentialcommercial", "segment", "usage", "class"] },

  { key: "unitNumber", label: "Unit number", templateHeader: "unit",
    sample: "1206",
    synonyms: ["unit", "unitno", "unitnumber", "flat", "flatno", "apartmentno", "doorno"] },

  { key: "building", label: "Building / project", templateHeader: "Building", required: true,
    sample: "cayan tower",
    synonyms: ["building", "buildingname", "project", "tower", "property", "propertyname"] },

  { key: "location", label: "Location / community", templateHeader: "Location",
    sample: "dubai marina",
    synonyms: ["location", "area", "community", "district", "city"] },

  { key: "beds", label: "Bedrooms (1BHK, studio, 2bhk+maid)", templateHeader: "Beds",
    sample: "1bhk",
    synonyms: ["beds", "bed", "bedrooms", "bhk", "layout", "configuration", "rooms"] },

  { key: "price", label: "Price (700k, 135k, 3.25M)", templateHeader: "Price (AED)",
    sample: "135k",
    synonyms: ["price", "priceaed", "rent", "rentaed", "annualrent", "amount", "askingprice", "sellingprice"] },

  { key: "area", label: "Area (699sqft)", templateHeader: "Area sqft",
    sample: "713.54sqft",
    synonyms: ["area", "sqft", "areasqft", "size", "builtuparea", "bua", "plotarea"] },

  // "Vadio" is how the column is actually spelled in these sheets — kept verbatim so a file saved
  // from the template and a file saved from the original both map.
  { key: "pictures", label: "Photos / video on file (yes / no)", templateHeader: "Pictures/Vadio",
    sample: "yes",
    synonyms: ["pictures", "picturesvadio", "picturesvideo", "photos", "media", "images", "pics"] },

  { key: "furnishing", label: "Furnishing", templateHeader: "Furnished/Fitted",
    sample: "furnished",
    synonyms: ["furnished", "furnishing", "furnishedfitted", "fitted"] },

  { key: "listing", label: "Advertised on a portal (yes / no)", templateHeader: "Listing",
    sample: "no",
    synonyms: ["listing", "listed", "advertised", "portal", "published"] },

  // Listed separately from the agent: this column holds who advertised it and under which permit,
  // which is not the same person as the one handling enquiries.
  { key: "listedBy", label: "Listed by / permit no.", templateHeader: "listed By/permit no",
    sample: "zaryab / 7126390600",
    synonyms: ["listedby", "listedbypermitno", "permit", "permitno", "advertisedby", "trakheesi"] },

  { key: "agent", label: "Agent (contact with)", templateHeader: "contact with",
    sample: "Nida",
    synonyms: ["contactwith", "agent", "assignee", "handledby", "consultant", "contact"] },

  { key: "ownerName", label: "Owner name", templateHeader: "Owners names",
    sample: "Majid",
    synonyms: ["owner", "ownername", "ownersnames", "ownersname", "landlord"] },

  { key: "ownerPhone", label: "Owner contact", templateHeader: "Numbers",
    sample: "507971468",
    synonyms: ["numbers", "number", "ownernumber", "phone", "mobile", "ownercontact", "contactno"] },

  // Also unheaded in the source sheets — a second number sits in the column after "Numbers".
  { key: "ownerPhoneAlt", label: "Owner contact (second number)", templateHeader: "Numbers 2",
    sample: "509040075",
    synonyms: ["numbers2", "number2", "altnumber", "alternatenumber", "secondnumber", "mobile2", "phone2"] },
];
