namespace Softaxis.AiAssistant.Infrastructure.Tools.Generic;

/// <summary>
/// The data-driven half of the AI Assistant's module coverage: every entry here becomes one
/// <see cref="GenericListTool"/> / <see cref="GenericGetByIdTool"/> / <see cref="GenericCreateTool"/> /
/// <see cref="GenericUpdateTool"/> / <see cref="GenericActionTool"/>, registered in a loop by
/// InfrastructureExtensions. Resources whose write body needs a nested array of line items
/// (invoices, journal entries, sales/purchase orders, visa applicants, ...) are hand-written tools
/// instead (see Tools/Crm, Tools/Finance, Tools/Sales, Tools/Purchase, Tools/Visa, Tools/Restaurant)
/// since a flat field list cannot express "N line items" — everything else belongs here as one
/// small entry rather than a bespoke class, so adding another module/resource is a data change,
/// not new code.
///
/// <para><b>Agent = module key.</b> <see cref="AiListSpec.Agent"/> and friends double as the module
/// key checked by <c>AiToolRegistry.IsModuleEnabled</c> — it must exactly match the tenant's
/// ResolvedModules entries (e.g. "hr", "finance", "restaurant", "visa", "b2b").</para>
///
/// <para><b>Permissions may list alternatives.</b> A comma-separated permission string passes if the
/// caller holds ANY of the keys — this mirrors the <c>[RequireAnyPermission]</c> attributes on the
/// tiered CRM controllers, where a team lead holds <c>crm.leads-team.edit</c> rather than the
/// tenant-wide <c>crm.leads.edit</c>. Declaring only the tenant-wide key would silently hide these
/// tools from exactly the roles the tiers exist to serve.</para>
///
/// <para><b>Deliberately absent: deletes.</b> Nothing here removes a record. Creating or correcting
/// data from chat is recoverable; deleting from a mis-parsed instruction is not, and the user asked
/// for add/modify.</para>
/// </summary>
public static class ModuleToolCatalog
{
    // ── Permission alternatives for the three-tier CRM scopes ─────────────────
    private const string CrmLeadsView      = "crm.leads.view,crm.leads-team.view,crm.leads-assigned.view";
    private const string CrmLeadsEdit      = "crm.leads.edit,crm.leads-team.edit,crm.leads-assigned.edit";
    private const string CrmPipelineView   = "crm.pipeline.view,crm.pipeline-team.view,crm.pipeline-assigned.view";
    private const string CrmPipelineEdit   = "crm.pipeline.edit,crm.pipeline-team.edit,crm.pipeline-assigned.edit";
    private const string CrmCustomersView  = "crm.customers.view,crm.customers-team.view,crm.customers-assigned.view";
    private const string CrmCustomersEdit  = "crm.customers.edit,crm.customers-team.edit,crm.customers-assigned.edit";

    public static readonly IReadOnlyList<AiListSpec> Lists =
    [
        // ── CRM ─────────────────────────────────────────────────────────────────
        new("crm_list_deals", "List sales-pipeline deals/opportunities — title, company, stage, value, owner.", "crm", "api/crm/deals", CrmPipelineView),
        new("crm_list_customers", "List CRM accounts/customers — name, industry, tier, account manager.", "crm", "api/crm/customers", CrmCustomersView),
        new("crm_list_contacts", "List contacts belonging to one CRM account.", "crm", "api/crm/contacts", CrmCustomersView,
        [
            new("customerId", "string", "Account id (GUID) whose contacts to list (required)", true),
        ]),
        new("crm_list_activities", "List CRM activities/tasks (calls, meetings, follow-ups) — optionally filtered to one record or to open/completed only.", "crm", "api/crm/activities", CrmLeadsView,
        [
            new("relatedToType", "string", "Filter to one record type: lead | deal | customer (optional)"),
            new("relatedToId",   "string", "Filter to one record's id (GUID) (optional)"),
            new("completed",     "boolean","true = only completed, false = only open (optional)"),
            new("type",          "string", "Activity type, e.g. call, meeting, email, task (optional)"),
        ]),

        // ── Finance ─────────────────────────────────────────────────────────────
        new("finance_list_accounts", "List chart-of-accounts accounts — number, name, type, balance.", "finance", "api/finance/accounts", "finance.accounting.view"),
        new("finance_list_account_types", "List the account types (asset/liability/equity/income/expense categories) with their ids — look one up here before creating an account.", "finance", "api/finance/lookups/account-types", null),
        new("finance_list_invoices", "List customer invoices — number, customer, status, totals, due date.", "finance", "api/finance/invoices", "finance.invoicing.view"),
        new("finance_list_expenses", "List company expenses — title, category, amount, status.", "finance", "api/finance/expenses", "finance.expenses.view"),
        new("finance_list_customers", "List Finance customers (billing contacts) — name, contact info, linked account.", "finance", "api/finance/customers", "finance.invoicing.view"),
        new("finance_list_suppliers", "List suppliers (vendors billed against) — name, contact info, linked account.", "finance", "api/finance/suppliers", "finance.expenses.view"),
        new("finance_list_budgets", "List budgets — name, period, status, lines.", "finance", "api/finance/budgets", "finance.budgeting.view"),
        new("finance_list_journals", "List journal entries — number, date, description, status, debit/credit totals, created by.", "finance", "api/finance/journals", "finance.journals.view"),
        new("finance_list_bank_accounts", "List bank accounts — name, bank, IBAN, currency, balance.", "finance", "api/finance/banking/accounts", "finance.banking.view"),
        new("finance_list_purchase_bills", "List supplier bills (accounts payable) — number, supplier, status, amount due.", "finance", "api/finance/purchase-bills", "finance.expenses.view"),

        // ── HR ──────────────────────────────────────────────────────────────────
        new("hr_list_employees", "List employees — name, department, job title, status, salary.", "hr", "api/hr/employees", "hr.employees.view"),
        new("hr_list_departments", "List departments with their ids — look one up here before creating or moving an employee.", "hr", "api/hr/departments", "hr.employees.view"),
        new("hr_list_leaves", "List leave requests — employee, type, dates, status.", "hr", "api/hr/leaves", "hr.leaves.view"),
        new("hr_list_leave_policies", "List the company's leave policies — type, annual entitlement, paid or unpaid.", "hr", "api/hr/leaves/policies", "hr.leaves.view"),
        new("hr_list_attendance", "List attendance records — employee, date, check-in/out, status, minutes late.", "hr", "api/hr/attendance", "hr.attendance.view"),
        new("hr_list_performance_reviews", "List performance reviews — employee, period, type, status.", "hr", "api/hr/performance", "hr.performance.view"),
        new("hr_list_job_postings", "List open job postings — title, department, status, headcount.", "hr", "api/hr/recruitment/jobs", "hr.recruitment.view"),
        new("hr_list_applicants", "List job applicants — name, job, stage.", "hr", "api/hr/recruitment/applicants", "hr.recruitment.view",
        [
            new("jobId", "string", "Only applicants for this job posting id (GUID) (optional)"),
            new("stage", "string", "Only applicants at this stage (optional)"),
        ]),
        new("hr_list_payroll_runs", "List payroll runs — period, status, totals.", "hr", "api/hr/payroll", "hr.payroll.view"),

        // ── Inventory ───────────────────────────────────────────────────────────
        new("inventory_list_warehouses", "List warehouses — name, code, address.", "inventory", "api/inventory/warehouses", "inventory.warehouses.view"),
        new("inventory_list_categories", "List product categories with their ids — look one up here before creating a product.", "inventory", "api/inventory/categories", "inventory.stock.view"),
        new("inventory_list_brands", "List product brands with their ids.", "inventory", "api/inventory/brands", "inventory.stock.view"),
        new("inventory_list_units_of_measure", "List units of measure with their ids — pieces, kg, litres and so on.", "inventory", "api/inventory/units-of-measure", "inventory.stock.view"),
        new("inventory_list_stock_movements", "List stock movements — product, type (receipt/write-off/adjustment/count-correction), quantity, date.", "inventory", "api/inventory/stock-movements", "inventory.movements.view"),
        new("inventory_list_transfers", "List stock transfers between warehouses — number, from/to, status.", "inventory", "api/inventory/transfers", "inventory.transfers.view"),

        // ── Purchase ────────────────────────────────────────────────────────────
        new("purchase_list_approvals", "List purchase approval requests (requisitions) — status, requester, amount.", "purchase", "api/purchase/approvals", "purchase.approvals.view"),
        new("purchase_list_grn", "List goods receipt notes — GRN number, purchase order, vendor, date.", "purchase", "api/purchase/grn", "purchase.orders.view"),
        new("purchase_list_returns", "List purchase returns to vendors — return number, purchase order, vendor, total.", "purchase", "api/purchase/returns", "purchase.orders.view"),

        // ── Sales ───────────────────────────────────────────────────────────────
        new("sales_list_customers", "List sales customers — name, contact info.", "sales", "api/sales/customers", "sales.orders.view"),
        new("sales_list_returns", "List sales returns — return number, order, customer, status.", "sales", "api/sales/returns", "sales.returns.view"),
        new("sales_list_delivery_challans", "List delivery challans — challan number, order, delivered quantities.", "sales", "api/sales/delivery-challans", "sales.orders.view"),

        // ── ProjectManagement ─────────────────────────────────────────────────
        // Issues are always scoped to one project (the API requires projectId), so this list is
        // useless without it — call projects_list first to get the id.
        new("projects_list_issues", "List Kanban issues/tasks/bugs in ONE project — title, status, assignee, priority. Call projects_list first to get the project id.", "project-management", "api/projectmanagement/issues", "project-management.issues.view",
        [
            new("projectId",     "string", "Project id (GUID) whose issues to list (required)", true),
            new("sprintId",      "string", "Only issues in this sprint id (GUID) (optional)"),
            new("boardColumnId", "string", "Only issues in this board column id (GUID) (optional)"),
            new("type",          "string", "Only this issue type: task | bug | story | epic (optional)"),
            new("assigneeName",  "string", "Only issues assigned to this person (optional)"),
            new("search",        "string", "Free-text search over titles (optional)"),
        ]),
        new("projects_list_columns", "List a project's Kanban board columns with their ids — needed to move an issue.", "project-management", "api/projectmanagement/projects/{projectId}/columns", "project-management.boards.view",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
        ]),
        new("projects_list_sprints", "List a project's sprints — name, goal, dates, status.", "project-management", "api/projectmanagement/projects/{projectId}/sprints", "project-management.sprints.view",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
        ]),
        new("projects_list_issue_comments", "List the comments on one issue.", "project-management", "api/projectmanagement/issues/{issueId}/comments", "project-management.issues.view",
        [
            new("issueId", "string", "Issue id (GUID) (required)", true),
        ]),

        // ── Restaurant ────────────────────────────────────────────────────────
        new("restaurant_list_menu", "List the restaurant menu — categories and items with prices and ids.", "restaurant", "api/restaurant/menu", "restaurant.menu.view"),
        new("restaurant_list_tables", "List restaurant tables — number, section, capacity, status.", "restaurant", "api/restaurant/tables", "restaurant.tables.view"),
        new("restaurant_list_orders", "List restaurant orders — table, status, items, total.", "restaurant", "api/restaurant/orders", "restaurant.orders.view"),
        new("restaurant_list_reservations", "List table reservations — guest, covers, date/time, status.", "restaurant", "api/restaurant/reservations", "restaurant.reservations.view",
        [
            new("date", "string", "Only reservations on this date, yyyy-MM-dd (optional)"),
        ]),
        new("restaurant_list_kitchen_tickets", "List live kitchen tickets — order, items, status, elapsed time.", "restaurant", "api/restaurant/kitchen/tickets", "restaurant.kitchen.view"),

        // ── Visa Services ─────────────────────────────────────────────────────
        new("visa_list_cases", "List visa cases — case number, client, type, status, SLA due date.", "visa", "api/visa/cases", "visa.cases.view",
        [
            new("status",     "string", "Only cases in this status (optional)"),
            new("customerId", "string", "Only cases for this account id (GUID) (optional)"),
        ]),
        new("visa_list_types", "List available visa types with their ids — name, category, fees, processing days, required documents.", "visa", "api/visa/types", "visa.cases.view"),
        new("visa_list_renewals", "List upcoming visa/passport/document expiries needing renewal.", "visa", "api/visa/cases/renewals", "visa.cases.view",
        [
            new("withinDays", "integer", "Horizon in days (default 90) (optional)"),
        ]),

        // ── B2B pack ──────────────────────────────────────────────────────────
        new("b2b_list_proposals", "List B2B proposals — client, title, amount, status, valid-until.", "b2b", "api/b2b/proposals", "b2b.proposals.view"),
        new("b2b_list_contracts", "List B2B service contracts — client, type, value, dates, SLA tier.", "b2b", "api/b2b/contracts", "b2b.contracts.view"),
        new("b2b_list_tickets", "List B2B support tickets — client, subject, priority, status.", "b2b", "api/b2b/tickets", "b2b.tickets.view"),

        // ── Education pack ────────────────────────────────────────────────────
        new("education_list_admissions", "List admission applications — applicant, program, intake, status.", "education", "api/education/admissions", "education.admissions.view"),
        new("education_list_students", "List students — name, program, guardian, contact.", "education", "api/education/students", "education.students.view"),
        new("education_list_enrollments", "List course enrollments — student, course, term, fees paid/outstanding.", "education", "api/education/enrollments", "education.enrollments.view"),

        // ── Healthcare pack ───────────────────────────────────────────────────
        new("healthcare_list_patients", "List patients — name, contact, assigned doctor, status.", "healthcare", "api/healthcare/patients", "healthcare.patients.view"),
        new("healthcare_list_appointments", "List appointments — patient, doctor, department, scheduled time, status.", "healthcare", "api/healthcare/appointments", "healthcare.appointments.view"),
        new("healthcare_list_treatment_plans", "List treatment plans — patient, diagnosis, plan, doctor, follow-up date.", "healthcare", "api/healthcare/treatment-plans", "healthcare.treatment-plans.view"),

        // ── Insurance pack ────────────────────────────────────────────────────
        new("insurance_list_policies", "List insurance policies — holder, product, premium, sum insured, dates, status.", "insurance", "api/insurance/policies", "insurance.policies.view"),
        new("insurance_list_renewals", "List policy renewals — policy, renewal date, status.", "insurance", "api/insurance/renewals", "insurance.renewals.view"),
        new("insurance_list_claims", "List insurance claims — policy, claim date, amount, status.", "insurance", "api/insurance/claims", "insurance.claims.view"),

        // ── POS ───────────────────────────────────────────────────────────────
        // Reads and catalogue/customer maintenance only. Taking a sale, voiding or refunding at a
        // till is deliberately NOT exposed: those move cash in a physical drawer and are tied to an
        // open shift, so they belong at the terminal, not in a chat window.
        new("pos_list_products", "List POS products — name, SKU, barcode, price, stock.", "pos", "api/products", "pos.products.view"),
        new("pos_list_customers", "List POS customers — name, phone, email, wallet/credit balances.", "pos", "api/customers", "pos.customers.view",
        [
            new("search", "string", "Free-text search over name/phone/email (optional)"),
        ]),
        new("pos_list_transactions", "List POS sales transactions — receipt number, total, payment method, status.", "pos", "api/transactions", "pos.transactions.view"),
    ];

    public static readonly IReadOnlyList<AiGetByIdSpec> GetByIds =
    [
        new("crm_get_lead", "Get one CRM lead's full detail by id.", "crm", "api/crm/leads/{id}", "leadId", CrmLeadsView),
        new("crm_get_customer", "Get one CRM account's full detail by id.", "crm", "api/crm/customers/{id}", "customerId", CrmCustomersView),
        new("finance_get_account", "Get one chart-of-accounts account's detail by id.", "finance", "api/finance/accounts/{id}", "accountId", "finance.accounting.view"),
        new("finance_get_invoice", "Get one invoice's full detail by id, including line items.", "finance", "api/finance/invoices/{id}", "invoiceId", "finance.invoicing.view"),
        new("finance_get_expense", "Get one expense's full detail by id.", "finance", "api/finance/expenses/{id}", "expenseId", "finance.expenses.view"),
        new("finance_get_budget", "Get one budget's full detail by id, including its lines.", "finance", "api/finance/budgets/{id}", "budgetId", "finance.budgeting.view"),
        new("hr_get_employee", "Get one employee's full detail by id.", "hr", "api/hr/employees/{id}", "employeeId", "hr.employees.view"),
        new("hr_get_leave", "Get one leave request's full detail by id.", "hr", "api/hr/leaves/{id}", "leaveId", "hr.leaves.view"),
        new("hr_get_payroll_run", "Get one payroll run's full detail by id, including payslips.", "hr", "api/hr/payroll/{id}", "payrollRunId", "hr.payroll.view"),
        new("inventory_get_product", "Get one product's full detail by id, including stock levels.", "inventory", "api/inventory/products/{id}", "productId", "inventory.stock.view"),
        new("purchase_get_order", "Get one purchase order's full detail by id, including line items.", "purchase", "api/purchase/orders/{id}", "orderId", "purchase.orders.view"),
        new("purchase_get_approval", "Get one purchase requisition's full detail by id.", "purchase", "api/purchase/approvals/{id}", "approvalId", "purchase.approvals.view"),
        new("sales_get_order", "Get one sales order's full detail by id, including line items.", "sales", "api/sales/orders/{id}", "orderId", "sales.orders.view"),
        new("sales_get_quotation", "Get one sales quotation's full detail by id, including line items.", "sales", "api/sales/quotations/{id}", "quotationId", "sales.quotations.view"),
        new("projects_get_issue", "Get one Kanban issue's full detail by id.", "project-management", "api/projectmanagement/issues/{id}", "issueId", "project-management.issues.view"),
        new("projects_get_project", "Get one project's full detail by id.", "project-management", "api/projectmanagement/projects/{id}", "projectId", "project-management.projects.view"),
        new("restaurant_get_order", "Get one restaurant order's full detail by id, including items and payments.", "restaurant", "api/restaurant/orders/{id}", "orderId", "restaurant.orders.view"),
        new("visa_get_case", "Get one visa case's full detail by id, including applicants and documents.", "visa", "api/visa/cases/{id}", "caseId", "visa.cases.view"),
        new("pos_get_product", "Get one POS product's full detail by id.", "pos", "api/products/{id}", "productId", "pos.products.view"),
        new("pos_get_customer", "Get one POS customer's full detail by id.", "pos", "api/customers/{id}", "customerId", "pos.customers.view"),
    ];

    public static readonly IReadOnlyList<AiCreateSpec> Creates =
    [
        // ── CRM ─────────────────────────────────────────────────────────────────
        new("crm_create_customer", "Create a new CRM account/customer (a company you do business with).", "crm", "api/crm/customers", "crm.customers.create",
        [
            new("name",                  "string", "Account/company name (required)", true),
            new("industry",              "string", "Industry", false, ""),
            new("country",               "string", "Country", false, ""),
            new("city",                  "string", "City", false, ""),
            new("address",               "string", "Street address", false, ""),
            new("phone",                 "string", "Phone number", false, ""),
            new("email",                 "string", "Email address", false, ""),
            new("tier",                  "string", "Account tier, e.g. standard, gold, strategic", false, "standard"),
            new("accountManager",        "string", "Account manager's name", false, ""),
            new("description",           "string", "Description", false, ""),
            new("accountManagerUserId",  "string", "Account manager's user id (GUID) — sets the owner (optional)"),
            new("teamId",                "string", "Team id (GUID) to file this account under, usually the owner's team (optional)"),
        ]),
        new("crm_create_contact", "Add a contact person to a CRM account. Look the account up first via crm_list_customers.", "crm", "api/crm/contacts", "crm.customers.create",
        [
            new("customerId", "string",  "Account id (GUID) this contact belongs to (required)", true),
            new("firstName",  "string",  "First name (required)", true),
            new("lastName",   "string",  "Last name (required)", true),
            new("title",      "string",  "Job title", false, ""),
            new("email",      "string",  "Email address", false, ""),
            new("phone",      "string",  "Phone number", false, ""),
            new("department", "string",  "Department (optional)"),
            new("isPrimary",  "boolean", "Whether this is the account's primary contact", false, "false"),
            new("notes",      "string",  "Notes (optional)"),
        ]),
        new("crm_create_activity", "Log a CRM activity or schedule a follow-up (call, meeting, email, task) against a lead, deal, or account.", "crm", "api/crm/activities", CrmLeadsEdit,
        [
            new("type",          "string", "Activity type: call | meeting | email | task | note (required)", true),
            new("subject",       "string", "Short subject line (required)", true),
            new("relatedToType", "string", "What it relates to: lead | deal | customer (required)", true),
            new("relatedToId",   "string", "Id (GUID) of that lead/deal/account (required)", true),
            new("description",   "string", "Details (optional)"),
            new("relatedToName", "string", "Display name of the related record (optional)"),
            new("dueDate",       "string", "Due date, yyyy-MM-dd (optional)"),
            new("assignedTo",    "string", "Who it is assigned to", false, AiFieldDefaults.CurrentUserName),
        ]),

        // ── Finance ─────────────────────────────────────────────────────────────
        new("finance_create_account", "Create a new chart-of-accounts account. Call finance_list_account_types first to get accountTypeId.", "finance", "api/finance/accounts", "finance.accounting.create",
        [
            new("accountNumber", "string", "Account number/code (required)", true),
            new("name",          "string", "Account name (required)", true),
            new("accountTypeId", "string", "Account type id (GUID) — asset/liability/equity/income/expense category (required)", true),
            new("description",   "string", "Description (optional)"),
            new("parentId",      "string", "Parent account id (GUID) for a sub-account (optional)"),
            new("isActive",      "boolean","Whether the account is active", false, "true"),
        ]),
        new("finance_create_expense", "Record a new company expense.", "finance", "api/finance/expenses", "finance.expenses.create",
        [
            new("title",         "string", "Expense title (required)", true),
            new("category",      "string", "Expense category (required)", true),
            new("amount",        "number", "Expense amount (required)", true),
            new("expenseDate",   "string", "Date, yyyy-MM-dd (required)", true),
            new("paidBy",        "string", "Who paid it (optional)"),
            new("paymentMethod", "string", "Payment method, e.g. cash, card, bank transfer (optional)"),
            new("reference",     "string", "Reference/receipt number (optional)"),
            new("notes",         "string", "Notes (optional)"),
        ]),
        new("finance_create_customer", "Create a new Finance customer (billing contact used on invoices).", "finance", "api/finance/customers", "finance.invoicing.create",
        [
            new("name",      "string", "Customer name (required)", true),
            new("email",     "string", "Email address (optional)"),
            new("phone",     "string", "Phone number (optional)"),
            new("address",   "string", "Address (optional)"),
            new("accountId", "string", "Chart-of-accounts account id (GUID) to link (optional)"),
            new("isActive",  "boolean","Whether active", false, "true"),
        ]),
        new("finance_create_supplier", "Create a new supplier (vendor billed via expenses/purchase bills).", "finance", "api/finance/suppliers", "finance.expenses.create",
        [
            new("name",      "string", "Supplier name (required)", true),
            new("email",     "string", "Email address (optional)"),
            new("phone",     "string", "Phone number (optional)"),
            new("address",   "string", "Address (optional)"),
            new("accountId", "string", "Chart-of-accounts account id (GUID) to link (optional)"),
            new("isActive",  "boolean","Whether active", false, "true"),
        ]),
        new("finance_create_bank_account", "Add a bank account.", "finance", "api/finance/banking/accounts", "finance.banking.create",
        [
            new("accountName",   "string", "Account name (required)", true),
            new("bankName",      "string", "Bank name (required)", true),
            new("accountNumber", "string", "Account number", false, ""),
            new("iban",          "string", "IBAN", false, ""),
            new("currency",      "string", "Currency code, e.g. AED, USD (required)", true),
            new("accountType",   "string", "e.g. current, savings", false, "current"),
        ]),
        new("finance_create_bank_transaction", "Record a manual bank transaction (inflow, outflow, or transfer). Call finance_list_bank_accounts first for accountId.", "finance", "api/finance/banking/transactions", "finance.banking.create",
        [
            new("accountId",   "string", "Bank account id (GUID) (required)", true),
            new("date",        "string", "Date, yyyy-MM-dd (required)", true),
            new("description", "string", "Description (required)", true),
            new("type",        "string", "inflow | outflow | transfer (required)", true),
            new("category",    "string", "Category", false, ""),
            new("amount",      "number", "Amount (required)", true),
            new("reference",   "string", "Reference (optional)"),
            new("toAccountId", "string", "Destination bank account id (GUID) — transfers only (optional)"),
        ]),

        // ── HR ──────────────────────────────────────────────────────────────────
        new("hr_create_employee", "Add a new employee.", "hr", "api/hr/employees", "hr.employees.create",
        [
            new("firstName",       "string", "First name (required)", true),
            new("lastName",        "string", "Last name (required)", true),
            new("email",           "string", "Email address (required)", true),
            new("phone",           "string", "Phone number (optional)"),
            new("jobTitle",        "string", "Job title (optional)"),
            new("departmentId",    "string", "Department id (GUID) — call hr_list_departments for it (optional)"),
            new("departmentName",  "string", "Department name if the id is unknown (optional)"),
            new("employmentType",  "string", "e.g. full_time, part_time, contract (required)", true),
            new("basicSalary",     "number", "Basic salary (required)", true),
            new("joiningDate",     "string", "Joining date, yyyy-MM-dd (required)", true),
            new("managerId",       "string", "Manager's employee id (GUID) (optional)"),
            new("notes",           "string", "Notes (optional)"),
        ]),
        new("hr_create_department", "Add a new department.", "hr", "api/hr/departments", "hr.employees.create",
        [
            new("name",        "string", "Department name (required)", true),
            new("code",        "string", "Short code (optional)"),
            new("description", "string", "Description (optional)"),
            new("managerId",   "string", "Department manager's employee id (GUID) (optional)"),
            new("isActive",    "boolean","Whether active", false, "true"),
        ]),
        new("hr_create_leave", "Submit a leave request for an employee. Look up employeeId/employeeName via hr_list_employees first.", "hr", "api/hr/leaves", "hr.leaves.create",
        [
            new("employeeId",   "string", "Employee id (GUID) (required)", true),
            new("employeeName", "string", "Employee's display name (required)", true),
            new("leaveType",    "string", "e.g. annual, sick, unpaid (required)", true),
            new("startDate",    "string", "Start date, yyyy-MM-dd (required)", true),
            new("endDate",      "string", "End date, yyyy-MM-dd (required)", true),
            new("totalDays",    "number", "Total days requested (required)", true),
            new("reason",       "string", "Reason (optional)"),
        ]),
        new("hr_mark_attendance", "Mark attendance for an employee on a given date. Look up employeeId/employeeName via hr_list_employees first.", "hr", "api/hr/attendance", "hr.attendance.create",
        [
            new("employeeId",   "string", "Employee id (GUID) (required)", true),
            new("employeeName", "string", "Employee's display name (required)", true),
            new("date",         "string", "Date, yyyy-MM-dd (required)", true),
            new("checkIn",      "string", "Check-in time, e.g. 09:00 (optional)"),
            new("checkOut",     "string", "Check-out time, e.g. 18:00 (optional)"),
            new("workingHours", "number", "Total working hours (optional)"),
            new("status",       "string", "e.g. present, absent, half_day, late (required)", true),
            new("notes",        "string", "Notes (optional)"),
        ]),
        new("hr_create_performance_review", "Schedule a performance review for an employee.", "hr", "api/hr/performance", "hr.performance.create",
        [
            new("employeeId",   "string", "Employee id (GUID) (required)", true),
            new("reviewPeriod", "string", "e.g. \"2026 H1\" (required)", true),
            new("reviewType",   "string", "One of: annual, mid_year, probation, pip (required)", true),
            new("dueDate",      "string", "Due date, yyyy-MM-dd (required)", true),
            new("reviewedBy",   "string", "Reviewer's name", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("hr_create_job_posting", "Post a new job opening.", "hr", "api/hr/recruitment/jobs", "hr.recruitment.create",
        [
            new("title",            "string", "Job title (required)", true),
            new("department",       "string", "Department (required)", true),
            new("branch",           "string", "Branch/location (required)", true),
            new("type",             "string", "e.g. full_time, part_time, contract (required)", true),
            new("experienceLevel",  "string", "e.g. entry, mid, senior (required)", true),
            new("headcount",        "integer","Number of openings (required)", true),
            new("salaryMin",        "number", "Minimum salary (required)", true),
            new("salaryMax",        "number", "Maximum salary (required)", true),
            new("currency",         "string", "Currency code (required)", true),
            new("closingDate",      "string", "Application closing date, yyyy-MM-dd (optional)"),
            new("hiringManager",    "string", "Hiring manager's name (optional)"),
            new("description",      "string", "Job description (required)", true),
            new("status",           "string", "e.g. open, draft, closed", false, "open"),
        ]),
        new("hr_generate_payroll_run", "Generate a draft payroll run for a period from all active employees (allowances and deductions start at zero — edit the slips afterwards).", "hr", "api/hr/payroll/generate", "hr.payroll.create",
        [
            new("period", "string", "Pay period, yyyy-MM, e.g. \"2026-08\" (required)", true),
            new("notes",  "string", "Notes (optional)"),
        ]),

        // ── Inventory ───────────────────────────────────────────────────────────
        new("inventory_create_product", "Add a new inventory product. Call inventory_list_categories first for categoryId.", "inventory", "api/inventory/products", "inventory.stock.create",
        [
            new("name",             "string", "Product name (required)", true),
            new("description",      "string", "Description (optional)"),
            new("sku",              "string", "SKU (optional)"),
            new("barcode",          "string", "Barcode (optional)"),
            new("categoryId",       "string", "Category id (GUID) (required)", true),
            new("brandId",          "string", "Brand id (GUID) (optional)"),
            new("unitOfMeasureId",  "string", "Unit of measure id (GUID) (optional)"),
            new("salePrice",        "number", "Sale price (required)", true),
            new("costPrice",        "number", "Cost price (required)", true),
            new("taxRate",          "number", "Tax rate percent (required)", true),
            new("unit",             "string", "Unit label, e.g. pcs, kg (required)", true),
            new("openingStock",     "number", "Opening stock quantity (required)", true),
            new("reorderLevel",     "number", "Reorder level (required)", true),
            new("trackInventory",   "boolean","Whether to track stock for this product", false, "true"),
            new("imageUrl",         "string", "Image URL (optional)"),
        ]),
        new("inventory_create_category", "Add a product category.", "inventory", "api/inventory/categories", "inventory.stock.create",
        [
            new("name",        "string", "Category name (required)", true),
            new("code",        "string", "Short code (optional)"),
            new("description", "string", "Description (optional)"),
            new("parentId",    "string", "Parent category id for a sub-category (optional)"),
            new("isActive",    "boolean","Whether active", false, "true"),
        ]),
        new("inventory_create_brand", "Add a product brand.", "inventory", "api/inventory/brands", "inventory.stock.create",
        [
            new("name",        "string", "Brand name (required)", true),
            new("code",        "string", "Short code (optional)"),
            new("description", "string", "Description (optional)"),
            new("logoUrl",     "string", "Logo URL (optional)"),
        ]),
        new("inventory_create_unit_of_measure", "Add a unit of measure.", "inventory", "api/inventory/units-of-measure", "inventory.stock.create",
        [
            new("name",        "string", "Unit name, e.g. Kilogram (required)", true),
            new("symbol",      "string", "Symbol, e.g. kg (required)", true),
            new("description", "string", "Description (optional)"),
        ]),
        new("inventory_create_warehouse", "Add a new warehouse.", "inventory", "api/inventory/warehouses", "inventory.warehouses.create",
        [
            new("name",           "string", "Warehouse name (required)", true),
            new("code",           "string", "Short code (optional)"),
            new("address",        "string", "Address (optional)"),
            new("contactPerson",  "string", "Contact person (optional)"),
            new("phone",          "string", "Phone number (optional)"),
            new("isActive",       "boolean","Whether active", false, "true"),
        ]),
        new("inventory_create_stock_movement", "Record a stock movement (receipt, write-off, adjustment, or count-correction). Call inventory_list_products first for productId.", "inventory", "api/inventory/stock-movements", "inventory.movements.create",
        [
            new("productId",   "string", "Product id (GUID) (required)", true),
            new("movementType","string", "One of: receipt, write-off, adjustment, count-correction (required)", true),
            new("quantity",    "number", "Quantity (required)", true),
            new("unitCost",    "number", "Unit cost (required)", true),
            new("reference",   "string", "Reference (optional)"),
            new("notes",       "string", "Notes (optional)"),
            new("warehouseId", "string", "Warehouse id (GUID) (optional)"),
            new("batchNumber", "string", "Batch number (optional)"),
        ]),

        // ── Purchase ────────────────────────────────────────────────────────────
        new("purchase_create_vendor", "Add a new vendor/supplier for purchasing.", "purchase", "api/purchase/vendors", "purchase.vendors.create",
        [
            new("name",           "string", "Vendor name (required)", true),
            new("code",           "string", "Short code (optional)"),
            new("category",       "string", "Vendor category (optional)"),
            new("contactPerson",  "string", "Contact person (optional)"),
            new("email",          "string", "Email address (optional)"),
            new("phone",          "string", "Phone number (optional)"),
            new("address",        "string", "Address (optional)"),
            new("taxNumber",      "string", "Tax registration number (optional)"),
            new("paymentTerms",   "string", "Payment terms, e.g. \"Net 30\" (optional)"),
            new("currency",       "string", "Currency code (optional)"),
            new("notes",          "string", "Notes (optional)"),
            new("status",         "string", "e.g. active, inactive", false, "active"),
        ]),

        // ── Sales ───────────────────────────────────────────────────────────────
        new("sales_create_customer", "Add a new sales customer.", "sales", "api/sales/customers", "sales.orders.create",
        [
            new("name",      "string", "Customer name (required)", true),
            new("email",     "string", "Email address (optional)"),
            new("phone",     "string", "Phone number (optional)"),
            new("address",   "string", "Address (optional)"),
            new("taxNumber", "string", "Tax registration number (optional)"),
            new("notes",     "string", "Notes (optional)"),
            new("isActive",  "boolean","Whether active", false, "true"),
        ]),

        // ── ProjectManagement ─────────────────────────────────────────────────
        new("projects_create_project", "Create a new project.", "project-management", "api/projectmanagement/projects", "project-management.projects.create",
        [
            new("name",        "string", "Project name (required)", true),
            new("description", "string", "Description (optional)"),
            new("leadName",    "string", "Project lead's name (optional)"),
        ]),
        // The reporter is taken from the caller's JWT by the controller, so it is not a field here.
        new("projects_create_issue", "Create a new Kanban issue — a task, bug, story, or epic. Call projects_list first to get the project id.", "project-management", "api/projectmanagement/issues", "project-management.issues.create",
        [
            new("projectId",     "string", "Project id (GUID) (required)", true),
            new("title",         "string", "Issue title (required)", true),
            new("description",   "string", "Description — for a bug, the steps to reproduce and what happens (optional)"),
            new("type",          "string", "task | bug | story | epic", false, "task"),
            new("priority",      "string", "low | medium | high | urgent", false, "medium"),
            new("boardColumnId", "string", "Board column id (GUID) to place it in (optional)"),
            new("assigneeId",    "string", "Assignee's user id (GUID) (optional)"),
            new("assigneeName",  "string", "Assignee's name (optional)"),
            new("sprintId",      "string", "Sprint id (GUID) (optional)"),
            new("storyPoints",   "number", "Story points (optional)"),
            new("dueDate",       "string", "Due date, yyyy-MM-dd (optional)"),
        ]),

        // ── Restaurant ────────────────────────────────────────────────────────
        new("restaurant_create_menu_category", "Add a menu category.", "restaurant", "api/restaurant/menu/categories", "restaurant.menu.create",
        [
            new("name",        "string", "Category name (required)", true),
            new("description", "string", "Description (optional)"),
            new("sortOrder",   "integer","Display order", false, "0"),
        ]),
        new("restaurant_create_menu_item", "Add a new menu item. Call restaurant_list_menu first for categoryId.", "restaurant", "api/restaurant/menu/items", "restaurant.menu.create",
        [
            new("categoryId",       "string", "Menu category id (GUID) (required)", true),
            new("name",             "string", "Item name (required)", true),
            new("description",      "string", "Description (optional)"),
            new("price",            "number", "Price (required)", true),
            new("prepTimeMinutes",  "integer","Preparation time in minutes (required)", true),
            new("allergens",        "string", "Allergen info (optional)"),
        ]),
        new("restaurant_create_table", "Add a new restaurant table.", "restaurant", "api/restaurant/tables", "restaurant.tables.create",
        [
            new("tableNumber", "string",  "Table number/label (required)", true),
            new("section",     "string",  "Section/area name (required)", true),
            new("capacity",    "integer", "Seating capacity (required)", true),
        ]),
        new("restaurant_create_reservation", "Book a table reservation.", "restaurant", "api/restaurant/reservations", "restaurant.reservations.create",
        [
            new("guestName",       "string",  "Guest name (required)", true),
            new("guestPhone",      "string",  "Guest phone number (required)", true),
            new("guestEmail",      "string",  "Guest email (optional)"),
            new("covers",          "integer", "Number of guests (required)", true),
            new("reservationDate", "string",  "Date, yyyy-MM-dd (required)", true),
            new("reservationTime", "string",  "Time, HH:mm (required)", true),
            new("specialRequests", "string",  "Special requests (optional)"),
            new("tableId",         "string",  "Table id (GUID) to reserve (optional)"),
        ]),

        // ── Visa Services ─────────────────────────────────────────────────────
        new("visa_create_type", "Add a visa type to the catalogue.", "visa", "api/visa/types", "visa.cases.edit",
        [
            new("name",              "string", "Visa type name (required)", true),
            new("category",          "string", "Category, e.g. employment, family, visit (required)", true),
            new("channel",           "string", "Government channel, e.g. manual, gdrfa, icp, mohre", false, "manual"),
            new("defaultGovtFee",    "number", "Default government fee (required)", true),
            new("defaultServiceFee", "number", "Default service fee (required)", true),
            new("processingDays",    "integer","Typical processing days (required)", true),
        ]),

        // ── B2B pack ──────────────────────────────────────────────────────────
        new("b2b_create_proposal", "Create a B2B proposal for a client.", "b2b", "api/b2b/proposals", "b2b.proposals.create",
        [
            new("clientName", "string", "Client name (required)", true),
            new("title",      "string", "Proposal title (required)", true),
            new("amount",     "number", "Proposal amount (required)", true),
            new("validUntil", "string", "Valid until, yyyy-MM-dd (required)", true),
            new("scope",      "string", "Scope of work (optional)"),
            new("notes",      "string", "Notes (optional)"),
            new("leadId",     "string", "Originating lead id (GUID) (optional)"),
            new("dealId",     "string", "Related deal id (GUID) (optional)"),
            new("customerId", "string", "Related account id (GUID) (optional)"),
        ]),
        new("b2b_create_contract", "Create a B2B service contract.", "b2b", "api/b2b/contracts", "b2b.contracts.create",
        [
            new("clientName",   "string", "Client name (required)", true),
            new("title",        "string", "Contract title (required)", true),
            new("contractType", "string", "Contract type, e.g. retainer, project, sla (required)", true),
            new("value",        "number", "Contract value (required)", true),
            new("startDate",    "string", "Start date, yyyy-MM-dd (required)", true),
            new("endDate",      "string", "End date, yyyy-MM-dd (required)", true),
            new("slaTier",      "string", "SLA tier (optional)"),
            new("notes",        "string", "Notes (optional)"),
            new("proposalId",   "string", "Originating proposal id (GUID) (optional)"),
            new("dealId",       "string", "Related deal id (GUID) (optional)"),
            new("customerId",   "string", "Related account id (GUID) (optional)"),
        ]),
        new("b2b_create_ticket", "Raise a B2B support ticket.", "b2b", "api/b2b/tickets", "b2b.tickets.create",
        [
            new("clientName",  "string", "Client name (required)", true),
            new("subject",     "string", "Ticket subject (required)", true),
            new("priority",    "string", "low | medium | high | urgent", false, "medium"),
            new("description", "string", "Description (optional)"),
            new("contractId",  "string", "Related contract id (GUID) (optional)"),
            new("customerId",  "string", "Related account id (GUID) (optional)"),
        ]),

        // ── Education pack ────────────────────────────────────────────────────
        new("education_create_admission", "Record a new admission application.", "education", "api/education/admissions", "education.admissions.create",
        [
            new("applicantName", "string", "Applicant's name (required)", true),
            new("program",       "string", "Program applied for (required)", true),
            new("intakeTerm",    "string", "Intake term, e.g. \"Fall 2026\" (optional)"),
            new("guardianName",  "string", "Guardian's name (optional)"),
            new("phone",         "string", "Phone number (optional)"),
            new("email",         "string", "Email address (optional)"),
            new("notes",         "string", "Notes (optional)"),
            new("leadId",        "string", "Originating lead id (GUID) (optional)"),
        ]),
        new("education_create_student", "Add a student record.", "education", "api/education/students", "education.students.create",
        [
            new("fullName",     "string", "Student's full name (required)", true),
            new("gender",       "string", "Gender (optional)"),
            new("program",      "string", "Program (optional)"),
            new("guardianName", "string", "Guardian's name (optional)"),
            new("phone",        "string", "Phone number (optional)"),
            new("email",        "string", "Email address (optional)"),
            new("notes",        "string", "Notes (optional)"),
            new("customerId",   "string", "Related account id (GUID) (optional)"),
        ]),
        new("education_create_enrollment", "Enroll a student on a course. Call education_list_students first for studentId.", "education", "api/education/enrollments", "education.enrollments.create",
        [
            new("studentId",   "string", "Student id (GUID) (required)", true),
            new("studentName", "string", "Student's name (required)", true),
            new("course",      "string", "Course name (required)", true),
            new("term",        "string", "Term (optional)"),
            new("feeTotal",    "number", "Total course fee (required)", true),
            new("notes",       "string", "Notes (optional)"),
        ]),

        // ── Healthcare pack ───────────────────────────────────────────────────
        new("healthcare_create_patient", "Register a new patient.", "healthcare", "api/healthcare/patients", "healthcare.patients.create",
        [
            new("fullName",       "string", "Patient's full name (required)", true),
            new("gender",         "string", "Gender (optional)"),
            new("dateOfBirth",    "string", "Date of birth, yyyy-MM-dd (optional)"),
            new("phone",          "string", "Phone number (optional)"),
            new("email",          "string", "Email address (optional)"),
            new("bloodGroup",     "string", "Blood group (optional)"),
            new("assignedDoctor", "string", "Assigned doctor (optional)"),
            new("notes",          "string", "Notes (optional)"),
            new("leadId",         "string", "Originating lead id (GUID) (optional)"),
            new("customerId",     "string", "Related account id (GUID) (optional)"),
        ]),
        new("healthcare_create_appointment", "Book a patient appointment. Call healthcare_list_patients first for patientId.", "healthcare", "api/healthcare/appointments", "healthcare.appointments.create",
        [
            new("patientId",   "string", "Patient id (GUID) (required)", true),
            new("patientName", "string", "Patient's name (required)", true),
            new("doctor",      "string", "Doctor (required)", true),
            new("department",  "string", "Department (optional)"),
            new("scheduledAt", "string", "Date and time, yyyy-MM-dd HH:mm (required)", true),
            new("reason",      "string", "Reason for the visit (optional)"),
            new("notes",       "string", "Notes (optional)"),
        ]),
        new("healthcare_create_treatment_plan", "Create a treatment plan for a patient.", "healthcare", "api/healthcare/treatment-plans", "healthcare.treatment-plans.create",
        [
            new("patientId",    "string", "Patient id (GUID) (required)", true),
            new("patientName",  "string", "Patient's name (required)", true),
            new("diagnosis",    "string", "Diagnosis (required)", true),
            new("plan",         "string", "The treatment plan (required)", true),
            new("doctor",       "string", "Doctor (required)", true),
            new("startDate",    "string", "Start date, yyyy-MM-dd (required)", true),
            new("followUpDate", "string", "Follow-up date, yyyy-MM-dd (optional)"),
            new("notes",        "string", "Notes (optional)"),
        ]),

        // ── Insurance pack ────────────────────────────────────────────────────
        new("insurance_create_policy", "Issue a new insurance policy.", "insurance", "api/insurance/policies", "insurance.policies.create",
        [
            new("holderName",  "string", "Policy holder's name (required)", true),
            new("productType", "string", "Product type, e.g. motor, health, life (required)", true),
            new("premium",     "number", "Premium amount (required)", true),
            new("sumInsured",  "number", "Sum insured (required)", true),
            new("startDate",   "string", "Start date, yyyy-MM-dd (required)", true),
            new("endDate",     "string", "End date, yyyy-MM-dd (required)", true),
            new("agent",       "string", "Agent's name (optional)"),
            new("notes",       "string", "Notes (optional)"),
            new("leadId",      "string", "Originating lead id (GUID) (optional)"),
            new("dealId",      "string", "Related deal id (GUID) (optional)"),
            new("customerId",  "string", "Related account id (GUID) (optional)"),
        ]),
        new("insurance_create_claim", "File an insurance claim against a policy. Call insurance_list_policies first for policyId.", "insurance", "api/insurance/claims", "insurance.claims.create",
        [
            new("policyId",    "string", "Policy id (GUID) (required)", true),
            new("claimDate",   "string", "Claim date, yyyy-MM-dd (required)", true),
            new("claimAmount", "number", "Claim amount (required)", true),
            new("reason",      "string", "Reason for the claim (optional)"),
            new("notes",       "string", "Notes (optional)"),
        ]),

        // ── POS ───────────────────────────────────────────────────────────────
        new("pos_create_customer", "Add a POS customer.", "pos", "api/customers", "pos.customers.edit",
        [
            new("name",    "string", "Customer name (required)", true),
            new("phone",   "string", "Phone number (optional)"),
            new("email",   "string", "Email address (optional)"),
            new("address", "string", "Address (optional)"),
            new("notes",   "string", "Notes (optional)"),
        ]),
    ];

    public static readonly IReadOnlyList<AiUpdateSpec> Updates =
    [
        // ── CRM ─────────────────────────────────────────────────────────────────
        new("crm_update_lead", "Change details on an existing lead — contact info, company, source, priority, value, requirements. Only pass the fields being changed; everything else is preserved. Use crm_set_lead_status to change status and crm_assign_lead to change the owner.", "crm", "api/crm/leads/{id}", CrmLeadsEdit,
        [
            new("firstName",         "string", "First name"),
            new("lastName",          "string", "Last name"),
            new("title",             "string", "Job title"),
            new("company",           "string", "Company name"),
            new("industry",          "string", "Industry"),
            new("email",             "string", "Email address"),
            new("phone",             "string", "Phone number"),
            new("country",           "string", "Country"),
            new("city",              "string", "City"),
            new("source",            "string", "Lead source"),
            new("priority",          "string", "low | medium | high"),
            new("estimatedValue",    "number", "Estimated deal value"),
            new("nextFollowUp",      "string", "Next follow-up date, yyyy-MM-dd"),
            new("notes",             "string", "Internal notes"),
            new("whatsApp",          "string", "WhatsApp number"),
            new("interestedIn",      "string", "What the lead is interested in"),
            new("budget",            "string", "Budget the lead mentioned"),
            new("message",           "string", "Message/note from the lead"),
            new("purchaseTimeframe", "string", "When they plan to buy, e.g. \"immediate\", \"1-3 months\""),
        ], "PUT", "api/crm/leads/{id}", "leadId"),

        new("crm_update_deal", "Change details on an existing opportunity/deal. Only pass what is changing. Use crm_move_deal_stage to change the stage.", "crm", "api/crm/deals/{id}", CrmPipelineEdit,
        [
            new("title",             "string", "Deal title"),
            new("company",           "string", "Company name"),
            new("value",             "number", "Deal value"),
            new("priority",          "string", "low | medium | high"),
            new("probability",       "integer","Win probability, 0-100"),
            new("expectedCloseDate", "string", "Expected close date, yyyy-MM-dd"),
            new("source",            "string", "Source"),
            new("industry",          "string", "Industry"),
            new("description",       "string", "Description"),
            new("nextAction",        "string", "Next action"),
            new("nextActionDate",    "string", "Next action date, yyyy-MM-dd"),
            new("forecastCategory",  "string", "pipeline | best_case | commit | closed | omitted"),
            new("customerId",        "string", "Account id (GUID) to link this deal to"),
        ], "PUT", "api/crm/deals/{id}", "dealId"),

        new("crm_update_customer", "Change details on an existing CRM account. Only pass what is changing.", "crm", "api/crm/customers/{id}", CrmCustomersEdit,
        [
            new("name",             "string", "Account/company name"),
            new("industry",         "string", "Industry"),
            new("country",          "string", "Country"),
            new("city",             "string", "City"),
            new("address",          "string", "Street address"),
            new("phone",            "string", "Phone number"),
            new("email",            "string", "Email address"),
            new("status",           "string", "Account status"),
            new("tier",             "string", "Account tier"),
            new("accountManager",   "string", "Account manager's name"),
            new("description",      "string", "Description"),
            new("website",          "string", "Website"),
            new("contractRenewal",  "string", "Contract renewal date, yyyy-MM-dd"),
        ], "PUT", "api/crm/customers/{id}", "customerId"),

        // ── Finance ─────────────────────────────────────────────────────────────
        new("finance_update_expense", "Change an existing expense — title, category, amount, date, payment details. Only pass what is changing.", "finance", "api/finance/expenses/{id}", "finance.expenses.edit",
        [
            new("title",         "string", "Expense title"),
            new("category",      "string", "Category"),
            new("amount",        "number", "Amount"),
            new("expenseDate",   "string", "Date, yyyy-MM-dd"),
            new("paidBy",        "string", "Who paid it"),
            new("paymentMethod", "string", "Payment method"),
            new("reference",     "string", "Reference/receipt number"),
            new("notes",         "string", "Notes"),
        ], "PUT", "api/finance/expenses/{id}", "expenseId"),

        new("finance_update_account", "Rename or re-describe a chart-of-accounts account, or activate/deactivate it.", "finance", "api/finance/accounts/{id}", "finance.accounting.edit",
        [
            new("accountNumber", "string", "Account number/code"),
            new("name",          "string", "Account name"),
            new("description",   "string", "Description"),
            new("isActive",      "boolean","Whether the account is active"),
            // The update endpoint requires an account type, but older accounts can have none
            // stored — exposing it means such a case is fixable here instead of just erroring.
            new("accountTypeId", "string", "Account type id (GUID) — only needed if the account has none set; get it from finance_list_account_types"),
        ], "PUT", "api/finance/accounts/{id}", "accountId"),

        new("finance_update_customer", "Change a Finance customer's details.", "finance", "api/finance/customers/{id}", "finance.invoicing.edit",
        [
            new("name",     "string", "Customer name"),
            new("email",    "string", "Email address"),
            new("phone",    "string", "Phone number"),
            new("address",  "string", "Address"),
            new("isActive", "boolean","Whether active"),
        ], "PUT", "api/finance/customers/{id}", "customerId"),

        new("finance_update_supplier", "Change a supplier's details.", "finance", "api/finance/suppliers/{id}", "finance.expenses.edit",
        [
            new("name",     "string", "Supplier name"),
            new("email",    "string", "Email address"),
            new("phone",    "string", "Phone number"),
            new("address",  "string", "Address"),
            new("isActive", "boolean","Whether active"),
        ], "PUT", "api/finance/suppliers/{id}", "supplierId"),

        // ── HR ──────────────────────────────────────────────────────────────────
        new("hr_update_employee", "Change an existing employee's details — job title, department, salary, contact info, status. Only pass what is changing.", "hr", "api/hr/employees/{id}", "hr.employees.edit",
        [
            new("firstName",      "string", "First name"),
            new("lastName",       "string", "Last name"),
            new("email",          "string", "Email address"),
            new("phone",          "string", "Phone number"),
            new("jobTitle",       "string", "Job title"),
            new("departmentId",   "string", "Department id (GUID) — call hr_list_departments for it"),
            new("departmentName", "string", "Department name"),
            new("employmentType", "string", "full_time | part_time | contract"),
            new("basicSalary",    "number", "Basic salary"),
            new("joiningDate",    "string", "Joining date, yyyy-MM-dd"),
            new("managerId",      "string", "Manager's employee id (GUID)"),
            new("status",         "string", "active | inactive | terminated"),
            new("nationality",    "string", "Nationality"),
            new("notes",          "string", "Notes"),
        ], "PUT", "api/hr/employees/{id}", "employeeId"),

        new("hr_update_attendance", "Correct an existing attendance record — check-in/out times, status, notes.", "hr", "api/hr/attendance/{id}", "hr.attendance.edit",
        [
            new("checkIn",      "string", "Check-in time, e.g. 09:00"),
            new("checkOut",     "string", "Check-out time, e.g. 18:00"),
            new("workingHours", "number", "Total working hours"),
            new("status",       "string", "present | absent | half_day | late"),
            new("notes",        "string", "Notes"),
        ], "PUT", "api/hr/attendance/{id}", "attendanceId"),

        new("hr_update_job_posting", "Change an existing job posting — title, headcount, salary band, description.", "hr", "api/hr/recruitment/jobs/{id}", "hr.recruitment.edit",
        [
            new("title",           "string", "Job title"),
            new("department",      "string", "Department"),
            new("branch",          "string", "Branch/location"),
            new("type",            "string", "full_time | part_time | contract"),
            new("experienceLevel", "string", "entry | mid | senior"),
            new("headcount",       "integer","Number of openings"),
            new("salaryMin",       "number", "Minimum salary"),
            new("salaryMax",       "number", "Maximum salary"),
            new("closingDate",     "string", "Closing date, yyyy-MM-dd"),
            new("hiringManager",   "string", "Hiring manager's name"),
            new("description",     "string", "Job description"),
        ], "PUT", "api/hr/recruitment/jobs/{id}", "jobId"),

        // ── Inventory ───────────────────────────────────────────────────────────
        new("inventory_update_product", "Change an existing product — name, prices, reorder level, category. Only pass what is changing. Use inventory_create_stock_movement to change stock on hand.", "inventory", "api/inventory/products/{id}", "inventory.stock.edit",
        [
            new("name",            "string", "Product name"),
            new("description",     "string", "Description"),
            new("sku",             "string", "SKU"),
            new("barcode",         "string", "Barcode"),
            new("categoryId",      "string", "Category id (GUID)"),
            new("brandId",         "string", "Brand id (GUID)"),
            new("unitOfMeasureId", "string", "Unit of measure id (GUID)"),
            new("salePrice",       "number", "Sale price"),
            new("costPrice",       "number", "Cost price"),
            new("taxRate",         "number", "Tax rate percent"),
            new("unit",            "string", "Unit label"),
            new("reorderLevel",    "number", "Reorder level"),
            new("imageUrl",        "string", "Image URL"),
        ], "PUT", "api/inventory/products/{id}", "productId"),

        new("inventory_update_warehouse", "Change a warehouse's details.", "inventory", "api/inventory/warehouses/{id}", "inventory.warehouses.edit",
        [
            new("name",          "string", "Warehouse name"),
            new("code",          "string", "Short code"),
            new("address",       "string", "Address"),
            new("contactPerson", "string", "Contact person"),
            new("phone",         "string", "Phone number"),
            new("isActive",      "boolean","Whether active"),
        ], "PUT", "api/inventory/warehouses/{id}", "warehouseId"),

        // ── Purchase ────────────────────────────────────────────────────────────
        new("purchase_update_vendor", "Change a vendor's details.", "purchase", "api/purchase/vendors/{id}", "purchase.vendors.edit",
        [
            new("name",          "string", "Vendor name"),
            new("code",          "string", "Short code"),
            new("category",      "string", "Vendor category"),
            new("contactPerson", "string", "Contact person"),
            new("email",         "string", "Email address"),
            new("phone",         "string", "Phone number"),
            new("address",       "string", "Address"),
            new("taxNumber",     "string", "Tax registration number"),
            new("paymentTerms",  "string", "Payment terms"),
            new("currency",      "string", "Currency code"),
            new("notes",         "string", "Notes"),
            new("status",        "string", "active | inactive"),
        ], "PUT", "api/purchase/vendors/{id}", "vendorId"),

        // ── Sales ───────────────────────────────────────────────────────────────
        new("sales_update_customer", "Change a sales customer's details.", "sales", "api/sales/customers/{id}", "sales.orders.edit",
        [
            new("name",      "string", "Customer name"),
            new("email",     "string", "Email address"),
            new("phone",     "string", "Phone number"),
            new("address",   "string", "Address"),
            new("taxNumber", "string", "Tax registration number"),
            new("notes",     "string", "Notes"),
            new("isActive",  "boolean","Whether active"),
        ], "PUT", "api/sales/customers/{id}", "customerId"),

        // ── ProjectManagement ─────────────────────────────────────────────────
        new("projects_update_issue", "Change an existing Kanban issue — title, description, type, priority, assignee, estimate, due date. Only pass what is changing. Use projects_move_issue to move it between board columns.", "project-management", "api/projectmanagement/issues/{id}", "project-management.issues.edit",
        [
            new("title",        "string", "Issue title"),
            new("description",  "string", "Description"),
            new("type",         "string", "task | bug | story | epic"),
            new("priority",     "string", "low | medium | high | urgent"),
            new("assigneeId",   "string", "Assignee's user id (GUID)"),
            new("assigneeName", "string", "Assignee's name"),
            new("storyPoints",  "number", "Story points"),
            new("dueDate",      "string", "Due date, yyyy-MM-dd"),
        ], "PUT", "api/projectmanagement/issues/{id}", "issueId"),

        new("projects_update_project", "Rename a project or change its description or lead.", "project-management", "api/projectmanagement/projects/{id}", "project-management.projects.edit",
        [
            new("name",        "string", "Project name"),
            new("description", "string", "Description"),
            new("leadName",    "string", "Project lead's name"),
        ], "PUT", "api/projectmanagement/projects/{id}", "projectId"),

        // ── POS ───────────────────────────────────────────────────────────────
        new("pos_update_product", "Change a POS product — name, prices, barcode, reorder level.", "pos", "api/products/{id}", "pos.products.edit",
        [
            new("name",         "string", "Product name"),
            new("description",  "string", "Description"),
            new("sku",          "string", "SKU"),
            new("barcode",      "string", "Barcode"),
            new("salePrice",    "number", "Sale price"),
            new("costPrice",    "number", "Cost price"),
            new("taxRate",      "number", "Tax rate percent"),
            new("unit",         "string", "Unit label"),
            new("reorderLevel", "number", "Reorder level"),
        ], "PUT", "api/products/{id}", "productId"),

        new("pos_update_customer", "Change a POS customer's details.", "pos", "api/customers/{id}", "pos.customers.edit",
        [
            new("name",    "string", "Customer name"),
            new("phone",   "string", "Phone number"),
            new("email",   "string", "Email address"),
            new("address", "string", "Address"),
            new("notes",   "string", "Notes"),
        ], "PUT", "api/customers/{id}", "customerId"),
    ];

    public static readonly IReadOnlyList<AiActionSpec> Actions =
    [
        // ── CRM ─────────────────────────────────────────────────────────────────
        new("crm_set_lead_status", "Move a lead to a different status (new, contacted, qualified, unqualified).", "crm", "PATCH", "api/crm/leads/{leadId}/status", CrmLeadsEdit,
        [
            new("leadId", "string", "Lead id (GUID) (required)", true),
            new("status", "string", "new | contacted | qualified | unqualified (required)", true),
        ]),
        new("crm_move_deal_stage", "Move a deal to a different pipeline stage. When moving to \"lost\", give a lossReason.", "crm", "PATCH", "api/crm/deals/{dealId}/stage", CrmPipelineEdit,
        [
            new("dealId",           "string", "Deal id (GUID) (required)", true),
            new("stage",            "string", "Target stage, e.g. qualification, proposal, negotiation, won, lost (required)", true),
            new("probability",      "integer","Win probability 0-100 for the new stage (required)", true),
            new("forecastCategory", "string", "pipeline | best_case | commit | closed | omitted — omit to let the system derive it (optional)"),
            new("lossReason",       "string", "Why the deal was lost — only when the stage is \"lost\" (optional)"),
        ]),
        new("crm_update_activity", "Rewrite an activity's type, subject, description, due date, or owner. Pass every field — this replaces the activity's details.", "crm", "PUT", "api/crm/activities/{activityId}", CrmLeadsEdit,
        [
            new("activityId",  "string", "Activity id (GUID) (required)", true),
            new("type",        "string", "call | meeting | email | task | note (required)", true),
            new("subject",     "string", "Subject line (required)", true),
            new("description", "string", "Details (optional)"),
            new("dueDate",     "string", "Due date, yyyy-MM-dd (optional)"),
            new("assignedTo",  "string", "Who it is assigned to", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("crm_complete_activity", "Mark a CRM activity as done.", "crm", "POST", "api/crm/activities/{activityId}/complete", CrmLeadsEdit,
        [
            new("activityId", "string", "Activity id (GUID) (required)", true),
        ]),
        new("crm_reopen_activity", "Reopen a completed CRM activity.", "crm", "POST", "api/crm/activities/{activityId}/reopen", CrmLeadsEdit,
        [
            new("activityId", "string", "Activity id (GUID) (required)", true),
        ]),
        new("crm_set_primary_contact", "Make a contact the primary contact for its account.", "crm", "POST", "api/crm/contacts/{contactId}/primary", "crm.customers.edit",
        [
            new("contactId", "string", "Contact id (GUID) (required)", true),
        ]),

        // ── Finance ─────────────────────────────────────────────────────────────
        new("finance_approve_expense", "Approve a submitted expense.", "finance", "POST", "api/finance/expenses/{expenseId}/approve", "finance.expenses.approve",
        [
            new("expenseId",  "string", "Expense id (GUID) (required)", true),
            new("approverId", "string", "Approver", false, AiFieldDefaults.CurrentUserId),
        ]),
        new("finance_reject_expense", "Reject a submitted expense.", "finance", "POST", "api/finance/expenses/{expenseId}/reject", "finance.expenses.approve",
        [
            new("expenseId",  "string", "Expense id (GUID) (required)", true),
            new("approverId", "string", "Approver", false, AiFieldDefaults.CurrentUserId),
        ]),
        new("finance_mark_expense_paid", "Mark an approved expense as paid.", "finance", "POST", "api/finance/expenses/{expenseId}/pay", "finance.expenses.edit",
        [
            new("expenseId", "string", "Expense id (GUID) (required)", true),
        ]),
        new("finance_send_invoice", "Send an invoice to the customer (marks it as sent).", "finance", "POST", "api/finance/invoices/{invoiceId}/send", "finance.invoicing.edit",
        [
            new("invoiceId", "string", "Invoice id (GUID) (required)", true),
        ]),
        new("finance_mark_invoice_paid", "Mark an invoice as paid.", "finance", "POST", "api/finance/invoices/{invoiceId}/pay", "finance.invoicing.edit",
        [
            new("invoiceId", "string", "Invoice id (GUID) (required)", true),
        ]),
        new("finance_cancel_invoice", "Cancel an invoice.", "finance", "POST", "api/finance/invoices/{invoiceId}/cancel", "finance.invoicing.edit",
        [
            new("invoiceId", "string", "Invoice id (GUID) (required)", true),
        ]),
        new("finance_set_budget_status", "Change a budget's status, e.g. activate or close it.", "finance", "POST", "api/finance/budgets/{budgetId}/status", "finance.budgeting.approve",
        [
            new("budgetId", "string", "Budget id (GUID) (required)", true),
            new("status",   "string", "New status, e.g. draft, active, closed (required)", true),
        ]),
        new("finance_approve_purchase_bill", "Approve a supplier bill for payment.", "finance", "POST", "api/finance/purchase-bills/{billId}/approve", "finance.expenses.approve",
        [
            new("billId", "string", "Purchase bill id (GUID) (required)", true),
        ]),

        // ── HR ──────────────────────────────────────────────────────────────────
        new("hr_approve_leave", "Approve a pending leave request.", "hr", "POST", "api/hr/leaves/{leaveId}/approve", "hr.leaves.approve",
        [
            new("leaveId",    "string", "Leave request id (GUID) (required)", true),
            new("notes",      "string", "Approval note (optional)"),
            new("approverId", "string", "Approver", false, AiFieldDefaults.CurrentUserId),
        ]),
        new("hr_reject_leave", "Reject a pending leave request.", "hr", "POST", "api/hr/leaves/{leaveId}/reject", "hr.leaves.approve",
        [
            new("leaveId",    "string", "Leave request id (GUID) (required)", true),
            new("notes",      "string", "Reason for rejection (optional)"),
            new("approverId", "string", "Approver", false, AiFieldDefaults.CurrentUserId),
        ]),
        new("hr_cancel_leave", "Cancel a leave request.", "hr", "POST", "api/hr/leaves/{leaveId}/cancel", "hr.leaves.edit",
        [
            new("leaveId", "string", "Leave request id (GUID) (required)", true),
        ]),
        new("hr_publish_job_posting", "Publish a draft job posting to the careers portal.", "hr", "POST", "api/hr/recruitment/jobs/{jobId}/publish", "hr.recruitment.edit",
        [
            new("jobId", "string", "Job posting id (GUID) (required)", true),
        ]),
        new("hr_set_job_posting_status", "Change a job posting's status, e.g. close it.", "hr", "POST", "api/hr/recruitment/jobs/{jobId}/status", "hr.recruitment.edit",
        [
            new("jobId",  "string", "Job posting id (GUID) (required)", true),
            new("status", "string", "New status, e.g. open, closed, on_hold (required)", true),
        ]),
        new("hr_set_applicant_stage", "Move an applicant to a different hiring stage.", "hr", "PUT", "api/hr/recruitment/applicants/{applicantId}/stage", "hr.recruitment.edit",
        [
            new("applicantId", "string", "Applicant id (GUID) (required)", true),
            new("stage",       "string", "New stage, e.g. screening, interview, offer, hired, rejected (required)", true),
        ]),
        new("hr_process_payroll_run", "Move a draft payroll run to processed, ready for Finance approval.", "hr", "POST", "api/hr/payroll/{payrollRunId}/process", "hr.payroll.approve",
        [
            new("payrollRunId", "string", "Payroll run id (GUID) (required)", true),
        ]),
        new("hr_reject_payroll_run", "Send a payroll run back with a reason.", "hr", "POST", "api/hr/payroll/{payrollRunId}/reject", "hr.payroll.approve",
        [
            new("payrollRunId", "string", "Payroll run id (GUID) (required)", true),
            new("reason",       "string", "Why it is being rejected (optional)"),
        ]),
        new("hr_start_performance_review", "Start a scheduled performance review.", "hr", "POST", "api/hr/performance/{reviewId}/start", "hr.performance.edit",
        [
            new("reviewId", "string", "Performance review id (GUID) (required)", true),
        ]),
        new("hr_complete_performance_review", "Mark a performance review as complete.", "hr", "POST", "api/hr/performance/{reviewId}/complete", "hr.performance.edit",
        [
            new("reviewId", "string", "Performance review id (GUID) (required)", true),
        ]),

        // ── Inventory ───────────────────────────────────────────────────────────
        new("inventory_activate_product", "Make a product active again so it can be sold.", "inventory", "PATCH", "api/inventory/products/{productId}/activate", "inventory.stock.edit",
        [
            new("productId", "string", "Product id (GUID) (required)", true),
        ]),
        new("inventory_deactivate_product", "Deactivate a product so it stops appearing for sale.", "inventory", "PATCH", "api/inventory/products/{productId}/deactivate", "inventory.stock.edit",
        [
            new("productId", "string", "Product id (GUID) (required)", true),
        ]),
        new("inventory_set_default_warehouse", "Make a warehouse the default one.", "inventory", "PATCH", "api/inventory/warehouses/{warehouseId}/set-default", "inventory.warehouses.edit",
        [
            new("warehouseId", "string", "Warehouse id (GUID) (required)", true),
        ]),
        new("inventory_submit_transfer", "Submit a draft stock transfer for approval.", "inventory", "POST", "api/inventory/transfers/{transferId}/submit", "inventory.transfers.create",
        [
            new("transferId", "string", "Stock transfer id (GUID) (required)", true),
        ]),
        new("inventory_approve_transfer", "Approve a submitted stock transfer.", "inventory", "POST", "api/inventory/transfers/{transferId}/approve", "inventory.transfers.approve",
        [
            new("transferId", "string", "Stock transfer id (GUID) (required)", true),
        ]),
        new("inventory_receive_transfer", "Mark a stock transfer as received at the destination warehouse.", "inventory", "POST", "api/inventory/transfers/{transferId}/receive", "inventory.transfers.approve",
        [
            new("transferId", "string", "Stock transfer id (GUID) (required)", true),
        ]),

        // ── Purchase ────────────────────────────────────────────────────────────
        // Binds a bare JSON string, not an object — hence RawBodyField (same as the sales one).
        new("purchase_set_order_status", "Change a purchase order's status, e.g. send it to the vendor or cancel it.", "purchase", "PATCH", "api/purchase/orders/{orderId}/status", "purchase.orders.edit",
        [
            new("orderId", "string", "Purchase order id (GUID) (required)", true),
            new("status",  "string", "New status, e.g. draft, sent, partial, received, cancelled (required)", true),
        ], "status"),
        new("purchase_approve_request", "Approve a purchase requisition.", "purchase", "POST", "api/purchase/approvals/{approvalId}/approve", "purchase.approvals.approve",
        [
            new("approvalId", "string", "Requisition id (GUID) (required)", true),
            new("by",         "string", "Approver", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("purchase_reject_request", "Reject a purchase requisition with a reason.", "purchase", "POST", "api/purchase/approvals/{approvalId}/reject", "purchase.approvals.approve",
        [
            new("approvalId", "string", "Requisition id (GUID) (required)", true),
            new("reason",     "string", "Why it is being rejected (required)", true),
            new("by",         "string", "Approver", false, AiFieldDefaults.CurrentUserName),
        ]),

        // ── Sales ───────────────────────────────────────────────────────────────
        // The endpoint binds a bare JSON string, not an object — hence RawBodyField.
        new("sales_set_order_status", "Change a sales order's status, e.g. confirm, ship, or cancel it.", "sales", "PATCH", "api/sales/orders/{orderId}/status", "sales.orders.edit",
        [
            new("orderId", "string", "Sales order id (GUID) (required)", true),
            new("status",  "string", "New status, e.g. pending, confirmed, shipped, delivered, cancelled (required)", true),
        ], "status"),
        new("sales_convert_quotation", "Convert an accepted quotation into a sales order.", "sales", "POST", "api/sales/quotations/{quotationId}/convert", "sales.quotations.edit",
        [
            new("quotationId", "string", "Quotation id (GUID) (required)", true),
        ]),
        new("sales_approve_return", "Approve a customer return.", "sales", "POST", "api/sales/returns/{returnId}/approve", "sales.returns.approve",
        [
            new("returnId", "string", "Sales return id (GUID) (required)", true),
            new("by",       "string", "Approver", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("sales_reject_return", "Reject a customer return.", "sales", "POST", "api/sales/returns/{returnId}/reject", "sales.returns.approve",
        [
            new("returnId", "string", "Sales return id (GUID) (required)", true),
            new("by",       "string", "Approver", false, AiFieldDefaults.CurrentUserName),
        ]),

        // ── ProjectManagement ─────────────────────────────────────────────────
        new("projects_move_issue", "Move an issue to a different board column. Call projects_list_columns first for boardColumnId.", "project-management", "POST", "api/projectmanagement/issues/{issueId}/move", "project-management.issues.edit",
        [
            new("issueId",       "string", "Issue id (GUID) (required)", true),
            new("boardColumnId", "string", "Target board column id (GUID) (required)", true),
            new("sortOrder",     "integer","Position within the column", false, "0"),
        ]),
        new("projects_move_issue_to_sprint", "Move an issue into a sprint, or back to the backlog by omitting sprintId.", "project-management", "POST", "api/projectmanagement/issues/{issueId}/move-to-sprint", "project-management.issues.edit",
        [
            new("issueId",   "string", "Issue id (GUID) (required)", true),
            new("sprintId",  "string", "Sprint id (GUID) — omit to move it to the backlog (optional)"),
            new("sortOrder", "integer","Position within the sprint", false, "0"),
        ]),
        new("projects_add_issue_comment", "Add a comment to an issue.", "project-management", "POST", "api/projectmanagement/issues/{issueId}/comments", "project-management.issues.edit",
        [
            new("issueId", "string", "Issue id (GUID) (required)", true),
            new("body",    "string", "The comment text (required)", true),
        ]),
        new("projects_create_sprint", "Create a sprint in a project.", "project-management", "POST", "api/projectmanagement/projects/{projectId}/sprints", "project-management.sprints.create",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
            new("name",      "string", "Sprint name (required)", true),
            new("goal",      "string", "Sprint goal (optional)"),
            new("startDate", "string", "Start date, yyyy-MM-dd (optional)"),
            new("endDate",   "string", "End date, yyyy-MM-dd (optional)"),
        ]),
        new("projects_start_sprint", "Start a sprint.", "project-management", "POST", "api/projectmanagement/projects/{projectId}/sprints/{sprintId}/start", "project-management.sprints.edit",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
            new("sprintId",  "string", "Sprint id (GUID) (required)", true),
        ]),
        new("projects_complete_sprint", "Complete a sprint.", "project-management", "POST", "api/projectmanagement/projects/{projectId}/sprints/{sprintId}/complete", "project-management.sprints.edit",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
            new("sprintId",  "string", "Sprint id (GUID) (required)", true),
        ]),
        new("projects_archive_project", "Archive a project.", "project-management", "POST", "api/projectmanagement/projects/{projectId}/archive", "project-management.projects.edit",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
        ]),
        new("projects_activate_project", "Reactivate an archived project.", "project-management", "POST", "api/projectmanagement/projects/{projectId}/activate", "project-management.projects.edit",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
        ]),
        new("projects_create_board_column", "Add a column to a project's Kanban board.", "project-management", "POST", "api/projectmanagement/projects/{projectId}/columns", "project-management.boards.create",
        [
            new("projectId", "string", "Project id (GUID) (required)", true),
            new("name",      "string", "Column name (required)", true),
            new("category",  "string", "Which lane it counts as: todo | in_progress | done", false, "todo"),
        ]),

        // ── Restaurant ────────────────────────────────────────────────────────
        // Menu items and tables have no single-record GET, so these replace the whole record:
        // read the current values from restaurant_list_menu / restaurant_list_tables first.
        new("restaurant_update_menu_item", "Change a menu item. This REPLACES the item's details, so read the current values via restaurant_list_menu first and pass them all.", "restaurant", "PUT", "api/restaurant/menu/items/{itemId}", "restaurant.menu.edit",
        [
            new("itemId",            "string",  "Menu item id (GUID) (required)", true),
            new("name",              "string",  "Item name (required)", true),
            new("description",       "string",  "Description (optional)"),
            new("price",             "number",  "Price (required)", true),
            new("prepTimeMinutes",   "integer", "Preparation time in minutes (required)", true),
            new("allergens",         "string",  "Allergen info (optional)"),
            new("isOnlineOrderable", "boolean", "Whether it can be ordered online", false, "true"),
        ]),
        new("restaurant_set_menu_item_availability", "Mark a menu item as available or sold out.", "restaurant", "PATCH", "api/restaurant/menu/items/{itemId}/availability", "restaurant.menu.edit",
        [
            new("itemId",      "string", "Menu item id (GUID) (required)", true),
            new("isAvailable", "boolean","true = available, false = sold out (required)", true),
        ]),
        new("restaurant_update_table", "Change a table's number, section, or capacity. This REPLACES those details, so read the current values via restaurant_list_tables first.", "restaurant", "PUT", "api/restaurant/tables/{tableId}", "restaurant.tables.edit",
        [
            new("tableId",     "string",  "Table id (GUID) (required)", true),
            new("tableNumber", "string",  "Table number/label (required)", true),
            new("section",     "string",  "Section/area name (required)", true),
            new("capacity",    "integer", "Seating capacity (required)", true),
        ]),
        new("restaurant_set_table_status", "Change a table's status, e.g. free, occupied, reserved, cleaning.", "restaurant", "PATCH", "api/restaurant/tables/{tableId}/status", "restaurant.tables.edit",
        [
            new("tableId", "string", "Table id (GUID) (required)", true),
            new("status",  "string", "New status (required)", true),
        ]),
        new("restaurant_send_order_to_kitchen", "Send an open order to the kitchen.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/send", "restaurant.orders.edit",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
        ]),
        new("restaurant_mark_order_ready", "Mark an order as ready to serve.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/ready", "restaurant.kitchen.edit",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
        ]),
        new("restaurant_mark_order_served", "Mark an order as served.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/serve", "restaurant.orders.edit",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
        ]),
        new("restaurant_apply_order_discount", "Apply a discount to an order. A reason is recorded on the audit trail.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/discount", "restaurant.orders.discount",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
            new("type",    "string", "percent | amount (required)", true),
            new("amount",  "number", "Discount percent or amount (required)", true),
            new("reason",  "string", "Why the discount is being given (required)", true),
        ]),
        new("restaurant_set_order_tip", "Set the tip on an order.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/tip", "restaurant.orders.edit",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
            new("amount",  "number", "Tip amount (required)", true),
        ]),
        new("restaurant_hold_order", "Park an open order aside without losing it.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/hold", "restaurant.orders.edit",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
        ]),
        new("restaurant_recall_order", "Bring a held order back so it can be worked on again.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/recall", "restaurant.orders.edit",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
        ]),
        new("restaurant_cancel_order", "Void a whole order. A reason is recorded on the audit trail.", "restaurant", "PATCH", "api/restaurant/orders/{orderId}/cancel", "restaurant.orders.void",
        [
            new("orderId", "string", "Order id (GUID) (required)", true),
            new("reason",  "string", "Why the order is being voided (required)", true),
        ]),
        new("restaurant_seat_reservation", "Seat a reservation that has arrived.", "restaurant", "PATCH", "api/restaurant/reservations/{reservationId}/seat", "restaurant.reservations.edit",
        [
            new("reservationId", "string", "Reservation id (GUID) (required)", true),
        ]),
        new("restaurant_cancel_reservation", "Cancel a reservation.", "restaurant", "PATCH", "api/restaurant/reservations/{reservationId}/cancel", "restaurant.reservations.edit",
        [
            new("reservationId", "string", "Reservation id (GUID) (required)", true),
        ]),
        new("restaurant_set_kitchen_item_status", "Update one kitchen ticket item's status, e.g. preparing or ready.", "restaurant", "PATCH", "api/restaurant/kitchen/items/{itemId}/status", "restaurant.kitchen.edit",
        [
            new("itemId", "string", "Order item id (GUID) (required)", true),
            new("status", "string", "New status, e.g. queued, preparing, ready (required)", true),
        ]),

        // ── Visa Services ─────────────────────────────────────────────────────
        new("visa_change_case_status", "Move a visa case to its next status. Give govtReference when submitting, rejectionReason when rejecting, and visaExpiryDate when issuing.", "visa", "PATCH", "api/visa/cases/{caseId}/status", "visa.cases.edit",
        [
            new("caseId",          "string", "Visa case id (GUID) (required)", true),
            new("status",          "string", "Target status, e.g. docs_pending, docs_complete, submitted, in_review, approved, issued, closed, rfi_required, rejected, cancelled (required)", true),
            new("govtReference",   "string", "Government reference number — when submitting (optional)"),
            new("rejectionReason", "string", "Reason — when rejecting (optional)"),
            new("visaExpiryDate",  "string", "Issued visa's expiry date, yyyy-MM-dd — when issuing (optional)"),
            new("note",            "string", "Note for the case timeline (optional)"),
            new("byName",          "string", "Who is doing this", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("visa_assign_case", "Assign a visa case to a PRO or case handler.", "visa", "PATCH", "api/visa/cases/{caseId}/assign", "visa.cases.edit",
        [
            new("caseId",     "string", "Visa case id (GUID) (required)", true),
            new("assignedTo", "string", "Name of the person to assign it to (required)", true),
            new("byName",     "string", "Who is doing this", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("visa_add_case_note", "Add a note to a visa case's timeline.", "visa", "POST", "api/visa/cases/{caseId}/notes", "visa.cases.edit",
        [
            new("caseId", "string", "Visa case id (GUID) (required)", true),
            new("note",   "string", "The note text (required)", true),
            new("byName", "string", "Who is adding it", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("visa_add_case_document", "Add a document requirement to a visa case's checklist.", "visa", "POST", "api/visa/cases/{caseId}/documents", "visa.cases.edit",
        [
            new("caseId",      "string", "Visa case id (GUID) (required)", true),
            new("name",        "string", "Document name, e.g. \"Passport copy\" (required)", true),
            new("applicantId", "string", "Applicant id (GUID) the document belongs to (optional)"),
            new("byName",      "string", "Who is adding it", false, AiFieldDefaults.CurrentUserName),
        ]),
        new("visa_update_case_document", "Update a checklist document's status — received, verified, rejected, or expired.", "visa", "PUT", "api/visa/cases/{caseId}/documents/{documentId}", "visa.cases.edit",
        [
            new("caseId",     "string", "Visa case id (GUID) (required)", true),
            new("documentId", "string", "Document id (GUID) (required)", true),
            new("status",     "string", "pending | received | verified | rejected | expired (required)", true),
            new("fileUrl",    "string", "Link to the uploaded file (optional)"),
            new("expiryDate", "string", "Document expiry date, yyyy-MM-dd (optional)"),
            new("notes",      "string", "Notes (optional)"),
            new("byName",     "string", "Who is doing this", false, AiFieldDefaults.CurrentUserName),
        ]),

        // ── B2B pack ──────────────────────────────────────────────────────────
        new("b2b_set_proposal_status", "Change a proposal's status, e.g. sent, accepted, rejected.", "b2b", "PATCH", "api/b2b/proposals/{proposalId}/status", "b2b.proposals.edit",
        [
            new("proposalId", "string", "Proposal id (GUID) (required)", true),
            new("status",     "string", "New status (required)", true),
        ]),
        new("b2b_set_contract_status", "Change a contract's status, e.g. active, expired, terminated.", "b2b", "PATCH", "api/b2b/contracts/{contractId}/status", "b2b.contracts.edit",
        [
            new("contractId", "string", "Contract id (GUID) (required)", true),
            new("status",     "string", "New status (required)", true),
        ]),
        new("b2b_resolve_ticket", "Resolve a support ticket.", "b2b", "POST", "api/b2b/tickets/{ticketId}/resolve", "b2b.tickets.edit",
        [
            new("ticketId",   "string", "Ticket id (GUID) (required)", true),
            new("resolution", "string", "How it was resolved (optional)"),
        ]),
        new("b2b_set_ticket_status", "Change a support ticket's status.", "b2b", "PATCH", "api/b2b/tickets/{ticketId}/status", "b2b.tickets.edit",
        [
            new("ticketId", "string", "Ticket id (GUID) (required)", true),
            new("status",   "string", "New status (required)", true),
        ]),

        // ── Education pack ────────────────────────────────────────────────────
        new("education_set_admission_status", "Change an admission application's status.", "education", "PATCH", "api/education/admissions/{admissionId}/status", "education.admissions.edit",
        [
            new("admissionId", "string", "Admission id (GUID) (required)", true),
            new("status",      "string", "New status, e.g. applied, interview, offered, accepted, rejected (required)", true),
        ]),
        new("education_enroll_admission", "Turn an accepted admission into a student record.", "education", "POST", "api/education/admissions/{admissionId}/enroll", "education.admissions.edit",
        [
            new("admissionId", "string", "Admission id (GUID) (required)", true),
        ]),
        new("education_record_enrollment_payment", "Record a fee payment against an enrollment.", "education", "POST", "api/education/enrollments/{enrollmentId}/payment", "education.enrollments.edit",
        [
            new("enrollmentId", "string", "Enrollment id (GUID) (required)", true),
            new("amount",       "number", "Amount paid (required)", true),
        ]),
        new("education_set_enrollment_status", "Change an enrollment's status.", "education", "PATCH", "api/education/enrollments/{enrollmentId}/status", "education.enrollments.edit",
        [
            new("enrollmentId", "string", "Enrollment id (GUID) (required)", true),
            new("status",       "string", "New status (required)", true),
        ]),

        // ── Healthcare pack ───────────────────────────────────────────────────
        new("healthcare_update_patient", "Change a patient's details. This REPLACES them, so read the current values via healthcare_list_patients first and pass them all.", "healthcare", "PUT", "api/healthcare/patients/{patientId}", "healthcare.patients.edit",
        [
            new("patientId",      "string", "Patient id (GUID) (required)", true),
            new("fullName",       "string", "Full name (required)", true),
            new("gender",         "string", "Gender (optional)"),
            new("dateOfBirth",    "string", "Date of birth, yyyy-MM-dd (optional)"),
            new("phone",          "string", "Phone number (optional)"),
            new("email",          "string", "Email address (optional)"),
            new("bloodGroup",     "string", "Blood group (optional)"),
            new("assignedDoctor", "string", "Assigned doctor (optional)"),
            new("status",         "string", "Patient status", false, "active"),
            new("notes",          "string", "Notes (optional)"),
        ]),
        new("healthcare_set_appointment_status", "Change an appointment's status, e.g. confirmed, completed, no-show, cancelled.", "healthcare", "PATCH", "api/healthcare/appointments/{appointmentId}/status", "healthcare.appointments.edit",
        [
            new("appointmentId", "string", "Appointment id (GUID) (required)", true),
            new("status",        "string", "New status (required)", true),
        ]),
        new("healthcare_set_treatment_plan_status", "Change a treatment plan's status.", "healthcare", "PATCH", "api/healthcare/treatment-plans/{planId}/status", "healthcare.treatment-plans.edit",
        [
            new("planId", "string", "Treatment plan id (GUID) (required)", true),
            new("status", "string", "New status (required)", true),
        ]),

        // ── Insurance pack ────────────────────────────────────────────────────
        new("insurance_set_policy_status", "Change a policy's status, e.g. active, lapsed, cancelled.", "insurance", "PATCH", "api/insurance/policies/{policyId}/status", "insurance.policies.edit",
        [
            new("policyId", "string", "Policy id (GUID) (required)", true),
            new("status",   "string", "New status (required)", true),
        ]),
        new("insurance_renew_policy", "Renew a policy for another term.", "insurance", "POST", "api/insurance/policies/{policyId}/renew", "insurance.renewals.create",
        [
            new("policyId",    "string", "Policy id (GUID) (required)", true),
            new("renewalDate", "string", "Renewal date, yyyy-MM-dd (required)", true),
            new("newPremium",  "number", "New premium, if it is changing (optional)"),
            new("notes",       "string", "Notes (optional)"),
        ]),
        new("insurance_complete_renewal", "Mark a renewal as completed.", "insurance", "POST", "api/insurance/renewals/{renewalId}/complete", "insurance.renewals.edit",
        [
            new("renewalId", "string", "Renewal id (GUID) (required)", true),
        ]),
        new("insurance_approve_claim", "Approve an insurance claim for a settlement amount.", "insurance", "POST", "api/insurance/claims/{claimId}/approve", "insurance.claims.approve",
        [
            new("claimId", "string", "Claim id (GUID) (required)", true),
            new("amount",  "number", "Approved settlement amount (required)", true),
        ]),
        new("insurance_set_claim_status", "Change a claim's status.", "insurance", "PATCH", "api/insurance/claims/{claimId}/status", "insurance.claims.edit",
        [
            new("claimId", "string", "Claim id (GUID) (required)", true),
            new("status",  "string", "New status (required)", true),
        ]),

        // ── POS ───────────────────────────────────────────────────────────────
        new("pos_adjust_product_stock", "Adjust a POS product's stock — purchase receipt, damage write-off, or stock-take correction.", "pos", "POST", "api/products/{productId}/stock-adjustment", "pos.products.edit",
        [
            new("productId",      "string", "Product id (GUID) (required)", true),
            new("quantity",       "number", "Quantity to adjust by (required)", true),
            new("adjustmentType", "string", "e.g. receipt, write-off, stock-take (required)", true),
            new("reference",      "string", "Reference (optional)"),
            new("notes",          "string", "Notes (optional)"),
        ]),
    ];
}
