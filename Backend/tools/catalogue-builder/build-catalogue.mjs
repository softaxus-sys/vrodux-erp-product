#!/usr/bin/env node
/**
 * Builds the bundled POS product-catalogue packs from the Open Food Facts bulk export (ODbL).
 *
 *   1. Download the dump once (about 1.2 GB):
 *        https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/en.openfoodfacts.org.products.csv.gz
 *   2. node build-catalogue.mjs <path-to-dump.csv.gz>          # every configured country
 *      node build-catalogue.mjs <dump> ae                      # one country
 *
 * Output: ../../src/Services/POS/Softaxis.POS.Infrastructure/Catalogue/Packs/{country}-grocery.json.gz
 * (embedded into the POS assembly). Re-run to refresh; commit the output.
 *
 * Why the dump and not the search API: the API stops serving results after roughly 1,000 rows per query
 * (deeper pages return 401/503) and asks clients to stay under ~10 searches a minute, so it cannot yield a
 * whole country. The dump is the supported route for bulk use.
 */
import { gzipSync, createGunzip } from "node:zlib";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../src/Services/POS/Softaxis.POS.Infrastructure/Catalogue/Packs");

/** country code -> Open Food Facts country tag + import defaults */
const COUNTRIES = {
  ae: { tag: "en:united-arab-emirates", name: "United Arab Emirates", taxRate: 5 },
  pk: { tag: "en:pakistan", name: "Pakistan", taxRate: 0 },
};

/** Ordered rules: first keyword found in any category tag wins. */
const GROCERY_CATEGORY_RULES = [
  ["Water", ["waters", "mineral-waters", "spring-waters"]],
  ["Beverages", ["beverages", "sodas", "juices", "teas", "coffees", "energy-drinks", "drinks"]],
  ["Dairy & Eggs", ["dairies", "milks", "cheeses", "yogurts", "butters", "creams", "eggs", "dairy"]],
  ["Bakery & Bread", ["breads", "bakery", "biscuits", "cakes", "pastries", "cookies", "wafers", "rusks"]],
  ["Breakfast & Cereals", ["breakfast", "cereals", "oat", "muesli", "spreads", "jams", "honeys", "chocolate-spreads"]],
  ["Snacks", ["snacks", "chips", "crisps", "popcorn", "nuts", "crackers", "salty-snacks", "dried-fruits"]],
  ["Confectionery", ["confectioneries", "chocolates", "candies", "sweets", "gums", "desserts", "ice-creams"]],
  ["Rice, Pasta & Grains", ["rices", "pastas", "noodles", "flours", "cereals-and-potatoes", "legumes", "lentils", "grains", "couscous"]],
  ["Canned & Jarred", ["canned", "preserved", "pickles", "olives", "tomato-pastes", "jars"]],
  ["Sauces & Condiments", ["sauces", "condiments", "ketchup", "mayonnaise", "mustard", "vinegars", "dressings", "chutneys"]],
  ["Oils & Ghee", ["oils", "fats", "ghee", "olive-oils", "vegetable-oils"]],
  ["Spices & Seasoning", ["spices", "seasonings", "salts", "herbs", "masala", "stocks", "bouillons"]],
  ["Meat, Fish & Frozen", ["meats", "fishes", "seafood", "frozen", "sausages", "poultry", "tunas", "chickens"]],
  ["Fruits & Vegetables", ["fruits", "vegetables", "plant-based-foods"]],
  ["Baby Food", ["baby", "infant"]],
];

/**
 * Most UAE/Pakistan entries in Open Food Facts carry no category at all (contributors skip it), so when the
 * tags say nothing we fall back to the product name. Deliberately conservative: a miss lands in
 * "Other Grocery", which is honest; a wrong guess would put the product in a category it doesn't belong to.
 */
const NAME_RULES = [
  ["Water", /\b(mineral )?water\b|\bzamzam\b|\bevian\b|\bperrier\b/i],
  ["Beverages", /\b(juice|soda|cola|pepsi|coke|sprite|fanta|7up|drink|tea|chai|coffee|nescafe|latte|cappuccino|frappuccino|squash|syrup|energy|smoothie|lassi|shake)\b/i],
  ["Dairy & Eggs", /\b(milk|cheese|yogh?urt|labneh|butter|cream|ghee|paneer|egg|eggs|laban|dahi|kefir)\b/i],
  ["Bakery & Bread", /\b(bread|bun|toast|cake|croissant|biscuit|biscuits|cookie|cookies|wafer|rusk|muffin|paratha|naan|roti|pastry)\b/i],
  ["Breakfast & Cereals", /\b(cereal|cornflakes|corn flakes|oats|muesli|granola|jam|honey|spread|nutella)\b/i],
  ["Snacks", /\b(chips|crisps|snack|popcorn|nuts|almond|cashew|pistachio|peanut|cracker|namkeen|puffs|kurkure|lays|pringles)\b/i],
  ["Confectionery", /\b(chocolate|candy|candies|sweet|sweets|gum|toffee|lollipop|jelly|marshmallow|ice cream|halwa|halva)\b/i],
  ["Rice, Pasta & Grains", /\b(rice|basmati|pasta|spaghetti|macaroni|noodles?|indomie|flour|atta|lentils?|dal|daal|beans|chickpeas?|couscous|vermicelli|semolina)\b/i],
  ["Canned & Jarred", /\b(canned|tinned|tuna|sardines?|pickles?|olives?|tomato paste)\b/i],
  ["Sauces & Condiments", /\b(sauce|ketchup|mayonnaise|mayo|mustard|vinegar|dressing|chutney|adobo)\b/i],
  ["Oils & Ghee", /\b(oil|olive oil|sunflower|canola|ghee)\b/i],
  ["Spices & Seasoning", /\b(spice|spices|masala|salt|pepper|seasoning|turmeric|cumin|cardamom|curry|stock cube|bouillon)\b/i],
  ["Meat, Fish & Frozen", /\b(chicken|beef|mutton|lamb|fish|shrimp|sausage|salami|frozen|nuggets|kebab|burger patty)\b/i],
  ["Fruits & Vegetables", /\b(fruit|vegetable|apple|banana|orange|mango|dates?|potato|onion|tomato)\b/i],
  ["Baby Food", /\b(baby|infant|formula|cerelac|toddler)\b/i],
];

function categorise(tagField, productName) {
  const flat = (tagField ?? "").split(",").map((t) => t.trim().replace(/^[a-z]{2}:/, "")).filter(Boolean);
  for (const [label, words] of GROCERY_CATEGORY_RULES) {
    if (flat.some((t) => words.some((w) => t === w || t.includes(w)))) return label;
  }
  for (const [label, re] of NAME_RULES) if (re.test(productName ?? "")) return label;
  return "Other Grocery";
}

/** EAN-8 / UPC-A / EAN-13 / GTIN-14 check-digit validation. */
function validGtin(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}

const tidy = (s) => (s ?? "").replace(/\s+/g, " ").trim();

const [dump, ...only] = process.argv.slice(2);
if (!dump) {
  console.error("usage: node build-catalogue.mjs <off.csv.gz> [ae|pk ...]");
  process.exit(1);
}
const targets = only.length ? only : Object.keys(COUNTRIES);
for (const cc of targets) if (!COUNTRIES[cc]) throw new Error(`Unknown country '${cc}'`);

const maps = Object.fromEntries(targets.map((cc) => [cc, new Map()]));
const rl = createInterface({ input: createReadStream(dump).pipe(createGunzip()), crlfDelay: Infinity });

let col = null, lines = 0, matched = 0;
for await (const line of rl) {
  const f = line.split("\t");
  if (!col) {
    col = Object.fromEntries(f.map((name, i) => [name, i]));
    for (const need of ["code", "product_name", "brands", "quantity", "categories_tags", "countries_tags"])
      if (!(need in col)) throw new Error(`Dump has no '${need}' column`);
    continue;
  }
  if (++lines % 500000 === 0) console.log(`  scanned ${lines.toLocaleString()} rows, ${matched} matched`);

  const countries = f[col.countries_tags] ?? "";
  if (!countries) continue;
  for (const cc of targets) {
    if (!countries.split(",").includes(COUNTRIES[cc].tag)) continue;
    const code = tidy(f[col.code]);
    const name = tidy(f[col.product_name]);
    if (!validGtin(code) || name.length < 2 || name.length > 150) continue;
    if (maps[cc].has(code)) continue;

    const brand = tidy((f[col.brands] ?? "").split(",")[0]);
    const qty = tidy(f[col.quantity]);
    let display = name;
    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) display = `${brand} ${name}`;
    if (qty && !display.toLowerCase().includes(qty.toLowerCase())) display = `${display} ${qty}`;

    maps[cc].set(code, { c: code, n: display.slice(0, 200), b: brand || undefined, q: qty || undefined, k: categorise(f[col.categories_tags], name) });
    matched++;
  }
}

mkdirSync(OUT, { recursive: true });
for (const cc of targets) {
  const cfg = COUNTRIES[cc];
  const items = [...maps[cc].values()].sort((a, b) => a.k.localeCompare(b.k) || a.n.localeCompare(b.n));
  const pack = {
    country: cc,
    countryName: cfg.name,
    industry: "grocery",
    taxRate: cfg.taxRate,
    source: "Open Food Facts (ODbL) — https://world.openfoodfacts.org",
    builtAt: new Date().toISOString().slice(0, 10),
    items,
  };
  const file = join(OUT, `${cc}-grocery.json.gz`);
  writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(pack), "utf8"), { level: 9 }));
  const byCat = {};
  for (const i of items) byCat[i.k] = (byCat[i.k] ?? 0) + 1;
  console.log(`${cc}: ${items.length} products -> ${file}`);
  console.log("  ", JSON.stringify(byCat));
}
