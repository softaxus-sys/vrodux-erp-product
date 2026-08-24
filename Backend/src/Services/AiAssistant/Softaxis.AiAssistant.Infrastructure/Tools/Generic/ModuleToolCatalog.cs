namespace Softaxis.AiAssistant.Infrastructure.Tools.Generic;

/// <summary>
/// The data-driven half of the AI Assistant's module coverage: every entry here becomes one
/// <see cref="GenericListTool"/>/<see cref="GenericGetByIdTool"/>/<see cref="GenericCreateTool"/>,
/// registered in a loop by InfrastructureExtensions. Resources whose create body needs a nested
/// array of line items (invoices, journal entries, sales/purchase orders, ...) are hand-written
/// tools instead (see Tools/Crm, Tools/Finance, Tools/Sales, Tools/Purchase) since a flat field
/// list can't express "N order lines" — everything else belongs here as one small entry rather
/// than a bespoke class, so adding another module/resource is a data change, not new code.
///
/// <see cref="AiListSpec.Agent"/>/<see cref="AiCreateSpec.Agent"/> etc. double as the module key
/// checked by <c>AiToolRegistry.IsModuleEnabled</c> — it must exactly match the tenant's
/// ResolvedModules entries (e.g. "hr", "finance", "restaurant", "visa").
/// </summary>
public static class ModuleToolCatalog
{
    public static readonly IReadOnlyList<AiListSpec> Lists =
    [
        // ── Finance ─────────────────────────────────────────────────────────────
        new("finance_list_accounts", "List chart-of-accounts accounts — number, name, type, balance.", "finance", "api/finance/accounts", "finance.accounting.view"),
        new("finance_list_invoices", "List customer invoices — number, customer, status, totals, due date.", "finance", "api/finance/invoices", "finance.invoicing.view"),
        new("finance_list_expenses", "List company expenses — title, category, amount, status.", "finance", "api/finance/expenses", "finance.expenses.view"),
        new("finance_list_customers", "List Finance customers (billing contacts) — name, contact info, linked account.", "finance", "api/finance/customers", "finance.invoicing.view"),
        new("finance_list_suppliers", "List suppliers (vendors billed against) — name, contact info, linked account.", "finance", "api/finance/suppliers", "finance.expenses.view"),
        new("finance_list_budgets", "List budgets — name, period, status, lines.", "finance", "api/finance/budgets", "finance.budgeting.view"),
        new("finance_list_journals", "List journal entries — number, date, description, status, debit/credit totals, created by.", "finance", "api/finance/journals", "finance.journals.view"),

        // ── HR ──────────────────────────────────────────────────────────────────
        new("hr_list_employees", "List employees — name, department, job title, status, salary.", "hr", "api/hr/employees", "hr.employees.view"),
        new("hr_list_leaves", "List leave requests — employee, type, dates, status.", "hr", "api/hr/leaves", "hr.leaves.view"),
        new("hr_list_attendance", "List attendance records — employee, date, check-in/out, status.", "hr", "api/hr/attendance", "hr.attendance.view"),
        new("hr_list_performance_reviews", "List performance reviews — employee, period, type, status.", "hr", "api/hr/performance", "hr.performance.view"),
        new("hr_list_job_postings", "List open job postings — title, department, status, headcount.", "hr", "api/hr/recruitment/jobs", "hr.recruitment.view"),

        // ── Inventory ───────────────────────────────────────────────────────────
        new("inventory_list_warehouses", "List warehouses — name, code, address.", "inventory", "api/inventory/warehouses", "inventory.warehouses.view"),
        new("inventory_list_stock_movements", "List stock movements — product, type (receipt/write-off/adjustment/count-correction), quantity, date.", "inventory", "api/inventory/stock-movements", "inventory.movements.view"),

        // ── Purchase (vendors/orders lists already exist as bespoke tools) ──────
        new("purchase_list_approvals", "List purchase approval requests — status, requester, amount.", "purchase", "api/purchase/approvals", "purchase.approvals.view"),

        // ── ProjectManagement ─────────────────────────────────────────────────
        new("projects_list_issues", "List Kanban issues/tasks — title, project, status, assignee, priority.", "project-management", "api/projectmanagement/issues", "project-management.issues.view"),

        // ── Restaurant ────────────────────────────────────────────────────────
        new("restaurant_list_menu", "List the restaurant menu — categories and items with prices.", "restaurant", "api/restaurant/menu", "restaurant.menu.view"),
        new("restaurant_list_tables", "List restaurant tables — number, section, capacity, status.", "restaurant", "api/restaurant/tables", "restaurant.tables.view"),
        new("restaurant_list_orders", "List restaurant orders — table, status, items, total.", "restaurant", "api/restaurant/orders", "restaurant.orders.view"),

        // ── Visa Services ─────────────────────────────────────────────────────
        new("visa_list_cases", "List visa cases — case number, client, type, status, SLA due date.", "visa", "api/visa/cases", "visa.cases.view"),
        new("visa_list_types", "List available visa types — name, category, fees, processing days.", "visa", "api/visa/types", "visa.cases.view"),
    ];

    public static readonly IReadOnlyList<AiGetByIdSpec> GetByIds =
    [
        new("finance_get_account", "Get one chart-of-accounts account's detail by id.", "finance", "api/finance/accounts/{id}", "accountId", "finance.accounting.view"),
        new("finance_get_invoice", "Get one invoice's full detail by id, including line items.", "finance", "api/finance/invoices/{id}", "invoiceId", "finance.invoicing.view"),
        new("hr_get_employee", "Get one employee's full detail by id.", "hr", "api/hr/employees/{id}", "employeeId", "hr.employees.view"),
        new("inventory_get_product", "Get one product's full detail by id, including stock levels.", "inventory", "api/inventory/products/{id}", "productId", "inventory.stock.view"),
        new("purchase_get_order", "Get one purchase order's full detail by id, including line items.", "purchase", "api/purchase/orders/{id}", "orderId", "purchase.orders.view"),
        new("sales_get_order", "Get one sales order's full detail by id, including line items.", "sales", "api/sales/orders/{id}", "orderId", "sales.orders.view"),
        new("projects_get_issue", "Get one Kanban issue's full detail by id.", "project-management", "api/projectmanagement/issues/{id}", "issueId", "project-management.issues.view"),
        new("visa_get_case", "Get one visa case's full detail by id, including applicants and documents.", "visa", "api/visa/cases/{id}", "caseId", "visa.cases.view"),
    ];

    public static readonly IReadOnlyList<AiCreateSpec> Creates =
    [
        // ── Finance ─────────────────────────────────────────────────────────────
        new("finance_create_account", "Create a new chart-of-accounts account. Look up accountTypeId first via the account-types lookup if you don't already know it.", "finance", "api/finance/accounts", "finance.accounting.create",
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

        // ── HR ──────────────────────────────────────────────────────────────────
        new("hr_create_employee", "Add a new employee.", "hr", "api/hr/employees", "hr.employees.create",
        [
            new("firstName",       "string", "First name (required)", true),
            new("lastName",        "string", "Last name (required)", true),
            new("email",           "string", "Email address (required)", true),
            new("phone",           "string", "Phone number (optional)"),
            new("jobTitle",        "string", "Job title (optional)"),
            new("departmentId",    "string", "Department id (GUID) (optional)"),
            new("departmentName",  "string", "Department name if id unknown (optional)"),
            new("employmentType",  "string", "e.g. full_time, part_time, contract (required)", true),
            new("basicSalary",     "number", "Basic salary (required)", true),
            new("joiningDate",     "string", "Joining date, yyyy-MM-dd (required)", true),
            new("managerId",       "string", "Manager's employee id (GUID) (optional)"),
            new("notes",           "string", "Notes (optional)"),
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
            new("reviewedBy",   "string", "Reviewer's name (required)", true),
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

        // ── Inventory ───────────────────────────────────────────────────────────
        new("inventory_create_product", "Add a new inventory product. Look up categoryId via the product categories list first.", "inventory", "api/inventory/products", "inventory.stock.create",
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
        new("inventory_create_warehouse", "Add a new warehouse.", "inventory", "api/inventory/warehouses", "inventory.warehouses.create",
        [
            new("name",           "string", "Warehouse name (required)", true),
            new("code",           "string", "Short code (optional)"),
            new("address",        "string", "Address (optional)"),
            new("contactPerson",  "string", "Contact person (optional)"),
            new("phone",          "string", "Phone number (optional)"),
            new("isActive",       "boolean","Whether active", false, "true"),
        ]),
        new("inventory_create_stock_movement", "Record a stock movement (receipt, write-off, adjustment, or count-correction). Look up productId via inventory_list_products first.", "inventory", "api/inventory/stock-movements", "inventory.movements.create",
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

        // ── ProjectManagement ─────────────────────────────────────────────────
        new("projects_create_project", "Create a new project.", "project-management", "api/projectmanagement/projects", "project-management.projects.create",
        [
            new("name",        "string", "Project name (required)", true),
            new("description", "string", "Description (optional)"),
            new("leadName",    "string", "Project lead's name (optional)"),
        ]),
        new("projects_create_issue", "Create a new Kanban issue/task. Look up projectId via projects_list first.", "project-management", "api/projectmanagement/issues", "project-management.issues.create",
        [
            new("projectId",     "string", "Project id (GUID) (required)", true),
            new("title",         "string", "Issue title (required)", true),
            new("reporterName",  "string", "Reporter's name (required)", true),
            new("description",   "string", "Description (optional)"),
            new("type",          "string", "e.g. task, bug, story, epic", false, "task"),
            new("priority",      "string", "e.g. low, medium, high, urgent", false, "medium"),
            new("assigneeId",    "string", "Assignee's user id (GUID) (optional)"),
            new("assigneeName",  "string", "Assignee's name (optional)"),
            new("sprintId",      "string", "Sprint id (GUID) (optional)"),
            new("storyPoints",   "number", "Story points (optional)"),
            new("dueDate",       "string", "Due date, yyyy-MM-dd (optional)"),
        ]),

        // ── Restaurant ────────────────────────────────────────────────────────
        new("restaurant_create_menu_item", "Add a new menu item. Look up categoryId via restaurant_list_menu first.", "restaurant", "api/restaurant/menu/items", "restaurant.menu.create",
        [
            new("categoryId",       "string", "Menu category id (GUID) (required)", true),
            new("name",             "string", "Item name (required)", true),
            new("description",      "string", "Description (optional)"),
            new("price",            "number", "Price (required)", true),
            new("prepTimeMinutes",  "number", "Preparation time in minutes (required)", true),
            new("allergens",        "string", "Allergen info (optional)"),
        ]),
        new("restaurant_create_table", "Add a new restaurant table.", "restaurant", "api/restaurant/tables", "restaurant.tables.create",
        [
            new("tableNumber", "string",  "Table number/label (required)", true),
            new("section",     "string",  "Section/area name (required)", true),
            new("capacity",    "integer", "Seating capacity (required)", true),
        ]),
    ];
}
