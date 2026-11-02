namespace Softaxis.AiAssistant.Infrastructure.Tools.Generic;

/// <summary>
/// Tool definitions for the modules added after the first catalogue: Real Estate, Hospitality
/// (hotel), Library, Lead Generation, SEO, E-commerce, Construction and Recipe. Same rules as
/// <see cref="ModuleToolCatalog"/> — Agent is the tenant's module key, a comma-separated permission
/// means "any of", nothing deletes, and every write is held for confirmation by the orchestrator.
///
/// <para>Deliberately NOT exposed: anything that moves or spends money on its own (posting to
/// Finance, taking a booking payment from a card, buying credits, revealing Lead Gen contacts —
/// which spends credits — or starting an e-mail campaign). Those stay one click in the screen,
/// where the cost is shown first.</para>
///
/// <para>Construction and Recipe have no permission keys of their own, so their tools are open to
/// anyone holding the module, exactly like their HTTP endpoints.</para>
/// </summary>
public static class ModuleToolCatalogMore
{
    private const string Re = "real-estate";

    public static readonly IReadOnlyList<AiListSpec> Lists =
    [
        // ── Real Estate ─────────────────────────────────────────────────────────
        new("realestate_list_listings", "List property listings (one listing = a unit in a building) — building, unit, purpose rent/sale, price, status, agent.", Re, "api/real-estate/listings", "real-estate.units.view",
        [
            new("search",  "string", "Free-text search over building, unit or area (optional)"),
            new("purpose", "string", "rent or sale (optional)"),
            new("status",  "string", "vacant, rented, reserved… (optional)"),
        ]),
        new("realestate_listings_summary", "Headline figures for the listings: how many, vacant, rented, total rent and asking price.", Re, "api/real-estate/listings/summary", "real-estate.units.view"),
        new("realestate_list_properties", "List buildings/properties — name, location, units, occupancy.", Re, "api/real-estate/properties", "real-estate.properties.view"),
        new("realestate_list_contracts", "List lease contracts — tenant, unit, term, annual rent, status, amount overdue.", Re, "api/real-estate/contracts", "real-estate.contracts.view"),
        new("realestate_contracts_summary", "Headline lease figures — active, expiring soon, rent collected and outstanding.", Re, "api/real-estate/contracts/summary", "real-estate.contracts.view"),
        new("realestate_list_rent_due", "List rent installments that are overdue or falling due soon, with tenant and amount — the rent-chasing queue.", Re, "api/real-estate/contracts/rent-due", "real-estate.rent.view"),
        new("realestate_list_expiring_leases", "List leases ending soon.", Re, "api/real-estate/rent-alerts/expiring", "real-estate.contracts.view"),
        new("realestate_list_tenants", "List tenants (people or companies renting) — name, contact, active leases.", Re, "api/real-estate/tenants", "real-estate.tenants.view"),
        new("realestate_list_brokers", "List brokers/agents the agency works with.", Re, "api/real-estate/brokers", "real-estate.brokers.view"),
        new("realestate_list_site_visits", "List property site visits (scheduled and done).", Re, "api/real-estate/site-visits", "real-estate.sales.view"),
        new("realestate_list_sale_reservations", "List property sale reservations.", Re, "api/real-estate/reservations", "real-estate.sales.view"),
        new("realestate_list_sale_bookings", "List property sale bookings with amounts paid.", Re, "api/real-estate/bookings", "real-estate.sales.view"),

        // ── Hospitality (hotel) ─────────────────────────────────────────────────
        new("hotel_list_rooms", "List hotel rooms — number, type, status, housekeeping state, nightly rate.", "hospitality", "api/hospitality/rooms", "hospitality.rooms.view,hospitality.bookings.create,hospitality.bookings.edit"),
        new("hotel_rooms_summary", "Hotel room counts by status.", "hospitality", "api/hospitality/rooms/summary", "hospitality.rooms.view"),
        new("hotel_check_availability", "Which rooms are free for a date range.", "hospitality", "api/hospitality/rooms/availability", "hospitality.bookings.view,hospitality.bookings.create",
        [
            new("checkIn",  "string", "Arrival date yyyy-MM-dd (required)", true),
            new("checkOut", "string", "Departure date yyyy-MM-dd (required)", true),
        ]),
        new("hotel_list_bookings", "List hotel reservations — guest, room, dates, status, total, balance.", "hospitality", "api/hospitality/bookings", "hospitality.bookings.view,hospitality.guests.view",
        [
            new("search", "string", "Guest name, email or booking number (optional)"),
            new("status", "string", "confirmed, checked_in, checked_out, cancelled… (optional)"),
        ]),
        new("hotel_front_desk", "Today's front desk — arrivals, departures and in-house guests.", "hospitality", "api/hospitality/bookings/front-desk", "hospitality.bookings.view"),
        new("hotel_bookings_summary", "Hotel booking headline figures.", "hospitality", "api/hospitality/bookings/summary", "hospitality.bookings.view"),
        new("hotel_list_housekeeping", "List housekeeping tasks — room, state, assigned to.", "hospitality", "api/hospitality/housekeeping", "hospitality.housekeeping.view"),
        new("hotel_list_tour_packages", "List tour packages sold by the travel agency side.", "hospitality", "api/hospitality/tours/packages", "hospitality.tours.view"),
        new("hotel_list_tour_bookings", "List tour bookings — customer, package, travellers, status, balance.", "hospitality", "api/hospitality/tours/bookings", "hospitality.tour-bookings.view"),

        // ── Library ─────────────────────────────────────────────────────────────
        new("library_dashboard", "Library overview — loans out, overdue, reservations waiting, fines unpaid.", "library", "api/library/dashboard", "library.circulation.view,library.catalog.view,library.members.view,library.fines.view,library.setup.view"),
        new("library_list_titles", "Search the library catalogue — title, authors, ISBN, copies available.", "library", "api/library/titles", "library.catalog.view,library.circulation.view",
        [
            new("search", "string", "Title, author or ISBN (optional)"),
        ]),
        new("library_list_members", "List library members — card number, name, membership type, expiry, status.", "library", "api/library/members", "library.members.view,library.circulation.view",
        [
            new("search", "string", "Name, card number, email or phone (optional)"),
        ]),
        new("library_list_loans", "List loans — member, book, due date, overdue days.", "library", "api/library/loans", "library.circulation.view,library.members.view",
        [
            new("status",   "string", "active, overdue or returned (optional)"),
            new("memberId", "string", "Only this member's loans, GUID (optional)"),
        ]),
        new("library_list_reservations", "List book reservations and who is waiting.", "library", "api/library/reservations", "library.circulation.view,library.members.view"),
        new("library_list_fines", "List fines — member, reason, amount, paid.", "library", "api/library/fines", "library.fines.view,library.members.view"),
        new("library_fines_summary", "Total fines raised, collected and outstanding.", "library", "api/library/fines/summary", "library.fines.view"),
        new("library_list_branches", "List library branches with their ids.", "library", "api/library/branches", "library.circulation.view,library.catalog.view,library.members.view,library.fines.view,library.setup.view"),
        new("library_list_membership_types", "List membership types with their ids — items allowed, loan days, fine per day.", "library", "api/library/membership-types", "library.circulation.view,library.catalog.view,library.members.view,library.fines.view,library.setup.view"),

        // ── Lead Generation ─────────────────────────────────────────────────────
        new("leadgen_dashboard", "Lead Generation overview — prospects found, revealed, campaigns and replies.", "leadgen", "api/leadgen/dashboard", "leadgen.reports.view"),
        new("leadgen_credits_wallet", "Lead Generation credit balance.", "leadgen", "api/leadgen/credits/wallet", "leadgen.searches.view,leadgen.prospects.view,leadgen.credits.view,leadgen.campaigns.view,leadgen.reports.view"),
        new("leadgen_list_searches", "List business searches that were run — name, area, categories, status, results.", "leadgen", "api/leadgen/searches", "leadgen.searches.view"),
        new("leadgen_list_prospects", "List prospects (businesses found) — name, category, city, contact revealed or not, quality score.", "leadgen", "api/leadgen/prospects", "leadgen.prospects.view",
        [
            new("search", "string", "Name or domain (optional)"),
            new("status", "string", "Prospect status (optional)"),
        ]),
        new("leadgen_prospect_stats", "Prospect counts by status.", "leadgen", "api/leadgen/prospects/stats", "leadgen.prospects.view"),
        new("leadgen_list_campaigns", "List e-mail campaigns — name, status, sent, opened, replied, bounced.", "leadgen", "api/leadgen/campaigns", "leadgen.campaigns.view"),
        new("leadgen_list_mailboxes", "List the connected sending mailboxes and their daily limits.", "leadgen", "api/leadgen/mailboxes", "leadgen.mailboxes.view,leadgen.campaigns.view,leadgen.campaigns.create,leadgen.inbox.view"),
        new("leadgen_inbox_threads", "List reply threads in the Lead Generation inbox.", "leadgen", "api/leadgen/inbox/threads", "leadgen.inbox.view"),
        new("leadgen_inbox_counts", "Unread and open counts for the Lead Generation inbox.", "leadgen", "api/leadgen/inbox/counts", "leadgen.inbox.view"),

        // ── SEO ─────────────────────────────────────────────────────────────────
        new("seo_credits_balance", "SEO credit balance — audits and comparisons are paid from it.", "seo", "api/seo/credits", "seo.sites.view"),
        new("seo_list_sites", "List the websites being tracked — domain, latest score, open issues, last audit.", "seo", "api/seo/sites", "seo.sites.view"),
        new("seo_catalogue_issues", "List online product listings with SEO problems — missing or weak titles and descriptions, no photos, duplicates.", "seo", "api/seo/catalogue", "seo.sites.view"),

        // ── E-commerce ──────────────────────────────────────────────────────────
        new("ecommerce_list_channels", "List connected sales channels (Shopify stores) — status and last sync.", "ecommerce", "api/ecommerce/channels", "ecommerce.channels.view"),
        new("ecommerce_list_listings", "List products published to the sales channels and their sync state.", "ecommerce", "api/ecommerce/listings", "ecommerce.listings.view"),
        new("ecommerce_list_channel_orders", "List orders that came in from the connected sales channels.", "ecommerce", "api/ecommerce/orders", "ecommerce.orders.view"),
        new("ecommerce_list_store_orders", "List orders placed on the workspace's own online store — number, customer, status, payment, total.", "ecommerce", "api/ecommerce/store/orders", "ecommerce.orders.view"),
        new("ecommerce_list_store_customers", "List online-store customers.", "ecommerce", "api/ecommerce/store/customers", "ecommerce.customers.view"),
        new("ecommerce_list_discount_codes", "List online-store discount codes and how often each was used.", "ecommerce", "api/ecommerce/store/discounts", "ecommerce.discounts.view"),

        // ── Construction (no permission keys) ───────────────────────────────────
        new("construction_list_projects", "List construction projects — client, location, contract value, progress.", "construction", "api/construction/projects", null),
        new("construction_projects_summary", "Construction project headline figures.", "construction", "api/construction/projects/summary", null),
        new("construction_list_sites", "List construction sites.", "construction", "api/construction/sites", null),
        new("construction_list_contractors", "List contractors.", "construction", "api/construction/contractors", null),
        new("construction_list_boq", "List bill-of-quantities lines.", "construction", "api/construction/boqs", null),

        // ── Recipe (no permission keys) ─────────────────────────────────────────
        new("recipe_list_recipes", "List recipes with cost per serving and status.", "recipe", "api/recipes", null),
        new("recipe_summary", "Recipe counts and average food cost.", "recipe", "api/recipes/summary", null),
        new("recipe_food_cost_report", "Food-cost report across recipes.", "recipe", "api/recipes/reports/food-cost", null),
        new("fitness_dashboard", "Gym overview — members, active and expiring memberships, who is inside now, today's takings, class and lead figures.", "fitness", "api/fitness/dashboard", "fitness.members.view,fitness.checkin.view,fitness.reports.view"),
        new("fitness_list_members", "Search gym members — number, name, phone, plan, membership state, balance owed.", "fitness", "api/fitness/members", "fitness.members.view,fitness.memberships.view,fitness.checkin.view,fitness.payments.view,fitness.classes.view,fitness.training.view",
        [
            new("search", "string", "Name, phone, email or member number (optional)"),
            new("state", "string", "active, expiring, expired, frozen, none (optional)"),
        ]),
        new("fitness_list_plans", "List membership plans with their ids and prices.", "fitness", "api/fitness/plans", "fitness.members.view,fitness.memberships.view,fitness.checkin.view,fitness.payments.view,fitness.classes.view,fitness.training.view"),
        new("fitness_list_branches", "List gym branches with their ids.", "fitness", "api/fitness/branches", "fitness.members.view,fitness.memberships.view,fitness.checkin.view,fitness.payments.view,fitness.classes.view,fitness.training.view"),
        new("fitness_list_payments", "List payments received — receipt, member, amount, method, date.", "fitness", "api/fitness/payments", "fitness.payments.view"),
        new("fitness_list_visits", "List recent gym check-ins, including refused ones.", "fitness", "api/fitness/visits", "fitness.checkin.view,fitness.members.view"),
        new("fitness_occupancy", "How many people are in the gym right now, per branch.", "fitness", "api/fitness/occupancy", "fitness.checkin.view"),
        new("fitness_list_class_types", "List class types (yoga, spin...) with ids.", "fitness", "api/fitness/class-types", "fitness.members.view,fitness.memberships.view,fitness.checkin.view,fitness.payments.view,fitness.classes.view,fitness.training.view"),
        new("fitness_list_sessions", "List scheduled classes — date, time, class, trainer, seats booked.", "fitness", "api/fitness/sessions", "fitness.classes.view,fitness.members.view"),
        new("fitness_list_trainers", "List trainers with their ids and rates.", "fitness", "api/fitness/trainers", "fitness.members.view,fitness.memberships.view,fitness.checkin.view,fitness.payments.view,fitness.classes.view,fitness.training.view"),
        new("fitness_list_pt_packages", "List personal-training packages — member, trainer, sessions used and left.", "fitness", "api/fitness/pt-packages", "fitness.training.view,fitness.members.view"),
        new("fitness_list_equipment", "List gym equipment and its status.", "fitness", "api/fitness/equipment", "fitness.facility.view"),
        new("fitness_list_lockers", "List lockers and who has them.", "fitness", "api/fitness/lockers", "fitness.facility.view,fitness.checkin.view"),
        new("fitness_list_leads", "List gym enquiries / leads and their follow-up status.", "fitness", "api/fitness/leads", "fitness.leads.view"),
    ];

    public static readonly IReadOnlyList<AiGetByIdSpec> GetByIds =
    [
        new("realestate_get_contract", "Get one lease contract with its rent schedule, payments and history.", Re, "api/real-estate/contracts/{id}", "contractId", "real-estate.contracts.view"),
        new("realestate_get_listing", "Get one property listing by id.", Re, "api/real-estate/listings/{id}", "listingId", "real-estate.units.view"),
        new("realestate_get_property", "Get one building by id with its units.", Re, "api/real-estate/properties/{id}", "propertyId", "real-estate.properties.view"),
        new("hotel_get_booking", "Get one hotel reservation by id with its folio and nights.", "hospitality", "api/hospitality/bookings/{id}", "bookingId", "hospitality.bookings.view"),
        new("library_get_member", "Get one library member by id with loans and fines.", "library", "api/library/members/{id}", "memberId", "library.members.view,library.circulation.view"),
        new("library_get_title", "Get one catalogue title by id with its copies.", "library", "api/library/titles/{id}", "titleId", "library.catalog.view,library.circulation.view"),
        new("leadgen_get_prospect", "Get one prospect by id with its contacts and score notes.", "leadgen", "api/leadgen/prospects/{id}", "prospectId", "leadgen.prospects.view"),
        new("leadgen_get_campaign", "Get one e-mail campaign by id with its steps and results.", "leadgen", "api/leadgen/campaigns/{id}", "campaignId", "leadgen.campaigns.view"),
        new("seo_get_site", "Get one tracked website by id — score, trend and settings.", "seo", "api/seo/sites/{id}", "siteId", "seo.sites.view"),
        new("construction_get_project", "Get one construction project by id.", "construction", "api/construction/projects/{id}", "projectId", ""),
        new("recipe_get_recipe", "Get one recipe by id with ingredients and cost.", "recipe", "api/recipes/{id}", "recipeId", ""),
        new("fitness_get_member", "Get one gym member by id with memberships, balance and recent visits.", "fitness", "api/fitness/members/{id}", "memberId", "fitness.members.view,fitness.memberships.view,fitness.checkin.view,fitness.payments.view,fitness.classes.view,fitness.training.view"),
    ];

    public static readonly IReadOnlyList<AiCreateSpec> Creates =
    [
        new("realestate_create_tenant", "Add a tenant (person or company) to Real Estate.", Re, "api/real-estate/tenants", "real-estate.tenants.create",
        [
            new("name",          "string", "Full name or company name (required)", true),
            new("tenantType",    "string", "individual or company (required)", true),
            new("email",         "string", "Email address (required)", true),
            new("phone",         "string", "Phone number (required)", true),
            new("nationality",   "string", "Nationality (required)", true),
            new("nationalId",    "string", "Emirates ID or national id (optional)"),
            new("companyName",   "string", "Company name for a company tenant (optional)"),
            new("tradeLicense",  "string", "Trade licence number (optional)"),
            new("passportNumber","string", "Passport number (optional)"),
            new("notes",         "string", "Notes (optional)"),
        ]),
        new("realestate_create_listing", "Add a property listing: the building (reused if the name already exists) plus one unit. Only name the building and the unit; leave everything else out unless the user gave it.", Re, "api/real-estate/listings", "real-estate.units.create",
        [
            new("propertyId",   "string", "Existing building id (GUID), or leave out and give propertyName"),
            new("propertyName", "string", "Building name — an existing building with this name is reused"),
            new("propertyType", "string", "Apartment, Villa, Office… (optional)"),
            new("city",         "string", "City (optional)"),
            new("address",      "string", "Address or area (optional)"),
            new("unitNumber",   "string", "Unit/door number (optional)"),
            new("unitType",     "string", "Studio, 1BHK, 2BHK… (optional)"),
            new("purpose",      "string", "rent or sale (required)", true),
            new("rentPerYear",  "number", "Yearly rent, for a rent listing", false, "0"),
            new("salePrice",    "number", "Asking price, for a sale listing", false, "0"),
            new("area",         "number", "Area in sq ft", false, "0"),
            new("floor",        "integer","Floor number", false, "0"),
            new("bedrooms",     "integer","Bedrooms (0 = studio) (optional)"),
            new("bathrooms",    "integer","Bathrooms (optional)"),
            new("parking",      "integer","Parking spaces", false, "0"),
            new("status",       "string", "vacant, rented or reserved (optional)"),
            new("agentName",    "string", "Agent handling it (optional)"),
            new("notes",        "string", "Notes (optional)"),
            new("propertyMarketValue", "number", "Building market value, only when creating a new building", false, "0"),
            new("serviceCharge","number", "Yearly service charge", false, "0"),
            new("hasMedia",     "boolean","Photos available", false, "false"),
            new("isListed",     "boolean","Advertised", false, "false"),
        ]),
        new("hotel_create_booking", "Create a hotel reservation for a guest in a room. Check availability first with hotel_check_availability and use a room id from hotel_list_rooms. No payment is taken here.", "hospitality", "api/hospitality/bookings", "hospitality.bookings.create",
        [
            new("roomId",    "string",  "Room id (GUID) (required)", true),
            new("guestName", "string",  "Guest full name (required)", true),
            new("guestEmail","string",  "Guest email (optional)"),
            new("guestPhone","string",  "Guest phone (optional)"),
            new("checkIn",   "string",  "Arrival date yyyy-MM-dd (required)", true),
            new("checkOut",  "string",  "Departure date yyyy-MM-dd (required)", true),
            new("nights",    "integer", "Number of nights (required)", true),
            new("adults",    "integer", "Adults", false, "1"),
            new("children",  "integer", "Children", false, "0"),
            new("source",    "string",  "Where the booking came from, e.g. phone, walk-in, website", false, "phone"),
            new("specialRequests", "string", "Special requests (optional)"),
        ]),
        new("library_create_member", "Add a library member. Look the membership type up with library_list_membership_types first.", "library", "api/library/members", "library.members.create",
        [
            new("fullName",         "string", "Full name (required)", true),
            new("membershipTypeId", "string", "Membership type id (GUID) (required)", true),
            new("email",            "string", "Email (optional)"),
            new("phone",            "string", "Phone (optional)"),
            new("address",          "string", "Address (optional)"),
            new("idNumber",         "string", "ID number (optional)"),
            new("homeBranchId",     "string", "Home branch id (GUID) (optional)"),
            new("expiresOn",        "string", "Membership expiry yyyy-MM-dd (optional)"),
            new("notes",            "string", "Notes (optional)"),
        ]),
        new("library_create_title", "Add a book/title to the catalogue, optionally with copies at a branch.", "library", "api/library/titles", "library.catalog.create",
        [
            new("title",           "string",  "Title (required)", true),
            new("authors",         "string",  "Authors (optional)"),
            new("isbn",            "string",  "ISBN (optional)"),
            new("publisher",       "string",  "Publisher (optional)"),
            new("publicationYear", "integer", "Year (optional)"),
            new("category",        "string",  "Category (optional)"),
            new("language",        "string",  "Language (optional)"),
            new("description",     "string",  "Description (optional)"),
            new("replacementCost", "number",  "Replacement cost if lost", false, "0"),
            new("copies",          "integer", "How many copies to add now", false, "0"),
            new("branchId",        "string",  "Branch id (GUID) for the copies (optional)"),
        ]),
        new("library_issue_loan", "Lend a copy to a member. Needs the member id and the copy id (look the copy up by barcode in the library).", "library", "api/library/loans", "library.circulation.create",
        [
            new("memberId", "string", "Member id (GUID) (required)", true),
            new("copyId",   "string", "Copy id (GUID) (required)", true),
            new("dueDate",  "string", "Due date yyyy-MM-dd (optional — the membership default applies)"),
        ]),
        new("seo_add_site", "Start tracking a website for SEO audits.", "seo", "api/seo/sites", "seo.sites.create",
        [
            new("domain",      "string", "The site's domain, e.g. example.com (required)", true),
            new("displayName", "string", "A name for it (required)", true),
            new("scanFrequency","string","weekly or daily (optional)"),
        ]),
        new("construction_create_project", "Add a construction project.", "construction", "api/construction/projects", "",
        [
            new("name",            "string", "Project name (required)", true),
            new("client",          "string", "Client (required)", true),
            new("location",        "string", "Location (required)", true),
            new("projectType",     "string", "Residential, Commercial, Infrastructure… (required)", true),
            new("startDate",       "string", "Start date yyyy-MM-dd (required)", true),
            new("endDate",         "string", "Planned end date yyyy-MM-dd (required)", true),
            new("contractValue",   "number", "Contract value (required)", true),
            new("projectManager",  "string", "Project manager (required)", true),
            new("siteEngineer",    "string", "Site engineer (required)", true),
            new("notes",           "string", "Notes (optional)"),
        ]),
        new("fitness_create_lead", "Record a gym enquiry / lead.", "fitness", "api/fitness/leads", "fitness.leads.create",
        [
            new("name",   "string", "Name (required)", true),
            new("phone",  "string", "Phone (optional)"),
            new("email",  "string", "Email (optional)"),
            new("source", "string", "Where they heard of the gym (optional)"),
            new("notes",  "string", "Notes (optional)"),
            new("status", "string", "new, contacted, tour, trial", false, "new"),
        ]),
        new("fitness_take_payment", "Record a payment from a gym member against a membership. Get the member and membership ids from fitness_get_member. Cannot exceed what is owed.", "fitness", "api/fitness/payments", "fitness.payments.create",
        [
            new("memberId",       "string", "Member id (GUID) (required)", true),
            new("subscriptionId", "string", "Membership id (GUID) (required)", true),
            new("amount",         "number", "Amount (required)", true),
            new("method",         "string", "cash, card, bank_transfer, online (required)", true),
        ]),
        new("fitness_check_in_member", "Check a member in at the front desk by member number. The desk's rules apply (expired, frozen, unpaid...) and a refusal is reported back.", "fitness", "api/fitness/checkin", "fitness.checkin.create",
        [
            new("memberRef", "string", "Member number, phone or card (required)", true),
            new("branchId",  "string", "Branch id (GUID) (required)", true),
        ]),
        new("fitness_book_class", "Book a member into a scheduled class. A full class puts them on the waitlist; a class credit is spent from their plan.", "fitness", "api/fitness/bookings", "fitness.classes.create",
        [
            new("sessionId",      "string",  "Class session id (GUID) (required)", true),
            new("memberId",       "string",  "Member id (GUID) (required)", true),
            new("allowWaitlist",  "boolean", "Join the waitlist if full", false, "true"),
        ]),
    ];

    public static readonly IReadOnlyList<AiUpdateSpec> Updates = [];

    public static readonly IReadOnlyList<AiActionSpec> Actions =
    [
        new("realestate_record_rent_payment", "Record a rent payment received against one installment of a lease. Get the contract and installment ids from realestate_get_contract. Cannot exceed what that installment still owes.", Re, "POST", "api/real-estate/contracts/{contractId}/installments/{installmentId}/payment", "real-estate.rent.record",
        [
            new("contractId",    "string", "Lease contract id (GUID) (required)", true),
            new("installmentId", "string", "Installment id (GUID) (required)", true),
            new("amount",        "number", "Amount received (required)", true),
            new("paidDate",      "string", "Date received yyyy-MM-dd (required)", true),
            new("method",        "string", "cash, cheque, transfer… (optional)"),
            new("reference",     "string", "Cheque or transfer reference (optional)"),
            new("notes",         "string", "Notes (optional)"),
        ]),
        new("realestate_send_rent_reminder", "E-mail a rent reminder to the tenant of one lease now.", Re, "POST", "api/real-estate/contracts/{contractId}/remind", "real-estate.rent.remind",
        [
            new("contractId", "string", "Lease contract id (GUID) (required)", true),
        ]),
        new("hotel_check_in", "Check a guest in. The reservation must be confirmed for today.", "hospitality", "PATCH", "api/hospitality/bookings/{bookingId}/checkin", "hospitality.bookings.edit",
        [
            new("bookingId", "string", "Reservation id (GUID) (required)", true),
        ]),
        new("hotel_check_out", "Check a guest out. Refused when a balance is still owed.", "hospitality", "PATCH", "api/hospitality/bookings/{bookingId}/checkout", "hospitality.bookings.edit",
        [
            new("bookingId", "string", "Reservation id (GUID) (required)", true),
        ]),
        new("hotel_cancel_booking", "Cancel a hotel reservation with a reason.", "hospitality", "POST", "api/hospitality/bookings/{bookingId}/cancel", "hospitality.bookings.edit",
        [
            new("bookingId",       "string", "Reservation id (GUID) (required)", true),
            new("reason",          "string", "Why it is cancelled (required)", true),
            new("cancellationFee", "number", "Fee charged, if any (optional)"),
        ]),
        new("library_return_loan", "Take a borrowed book back. Any late fine is raised automatically.", "library", "POST", "api/library/loans/{loanId}/return", "library.circulation.edit",
        [
            new("loanId",   "string",  "Loan id (GUID) (required)", true),
            new("damaged",  "boolean", "The book came back damaged", false, "false"),
            new("notes",    "string",  "Notes (optional)"),
        ]),
        new("library_renew_loan", "Renew a loan for another period. Refused past the renewal limit or while someone is waiting for the title.", "library", "POST", "api/library/loans/{loanId}/renew", "library.circulation.edit",
        [
            new("loanId", "string", "Loan id (GUID) (required)", true),
        ]),
        new("library_waive_fine", "Waive a library fine.", "library", "POST", "api/library/fines/{fineId}/waive", "library.fines.approve",
        [
            new("fineId", "string", "Fine id (GUID) (required)", true),
        ]),
        new("seo_approve_fix", "Approve a proposed SEO fix so it is applied to the site.", "seo", "POST", "api/seo/fixes/{fixId}/approve", "seo.fixes.edit",
        [
            new("fixId", "string", "Fix id (GUID) (required)", true),
        ]),
        new("seo_reject_fix", "Reject a proposed SEO fix.", "seo", "POST", "api/seo/fixes/{fixId}/reject", "seo.fixes.edit",
        [
            new("fixId", "string", "Fix id (GUID) (required)", true),
        ]),
        new("recipe_activate", "Make a recipe active.", "recipe", "PATCH", "api/recipes/{recipeId}/activate", "",
        [
            new("recipeId", "string", "Recipe id (GUID) (required)", true),
        ]),
        new("recipe_archive", "Archive a recipe.", "recipe", "PATCH", "api/recipes/{recipeId}/archive", "",
        [
            new("recipeId", "string", "Recipe id (GUID) (required)", true),
        ]),
        new("fitness_freeze_membership", "Freeze a gym membership. Refused if the plan does not allow it.", "fitness", "POST", "api/fitness/memberships/{id}/freeze", "fitness.memberships.edit",
        [
            new("id",     "string", "Membership id (GUID) (required)", true),
            new("reason", "string", "Reason (optional)"),
        ]),
        new("fitness_unfreeze_membership", "Unfreeze a gym membership; the end date moves out by the days it was frozen.", "fitness", "POST", "api/fitness/memberships/{id}/unfreeze", "fitness.memberships.edit",
        [
            new("id", "string", "Membership id (GUID) (required)", true),
        ]),
    ];
}
