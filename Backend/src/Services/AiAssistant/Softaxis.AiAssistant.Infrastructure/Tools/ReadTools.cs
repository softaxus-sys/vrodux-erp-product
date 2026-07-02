using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools;

/// <summary>
/// Simple read-only GET tools across modules. Each calls one ERP endpoint as the current user,
/// so tenant isolation + module licensing + RBAC are enforced automatically. Grouped here to keep
/// one small file per read endpoint; richer per-module tools can replace these incrementally.
/// </summary>
internal abstract class GetTool(GatewayToolClient gateway) : IAiTool
{
    protected readonly GatewayToolClient Gateway = gateway;
    public abstract string Name { get; }
    public abstract string Description { get; }
    public abstract string Agent { get; }
    public abstract string? RequiredPermission { get; }
    protected abstract string Path { get; }

    public bool IsReadOnly => true;
    public string ParametersJsonSchema => """{"type":"object","properties":{},"additionalProperties":false}""";
    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct) => Gateway.GetAsync(Path, ct);
}

internal sealed class FinanceInvoicesSummaryTool(GatewayToolClient g) : GetTool(g)
{
    public override string Name => "finance_invoices_summary";
    public override string Description => "Summary of customer invoices — totals, outstanding/overdue amounts, counts by status.";
    public override string Agent => "finance";
    public override string? RequiredPermission => "finance.invoicing.view";
    protected override string Path => "api/finance/invoices/summary";
}

internal sealed class FinanceExpensesSummaryTool(GatewayToolClient g) : GetTool(g)
{
    public override string Name => "finance_expenses_summary";
    public override string Description => "Summary of company expenses — totals, counts, and amounts by status.";
    public override string Agent => "finance";
    public override string? RequiredPermission => "finance.expenses.view";
    protected override string Path => "api/finance/expenses/summary";
}

internal sealed class HrEmployeesSummaryTool(GatewayToolClient g) : GetTool(g)
{
    public override string Name => "hr_employees_summary";
    public override string Description => "Summary of the workforce — headcount and breakdowns for employees.";
    public override string Agent => "hr";
    public override string? RequiredPermission => "hr.employees.view";
    protected override string Path => "api/hr/employees/summary";
}

internal sealed class SalesListOrdersTool(GatewayToolClient g) : GetTool(g)
{
    public override string Name => "sales_list_orders";
    public override string Description => "List sales orders — customer, status, totals. Use for questions about sales orders and revenue in progress.";
    public override string Agent => "sales";
    public override string? RequiredPermission => "sales.orders.view";
    protected override string Path => "api/sales/orders";
}

internal sealed class PurchaseListOrdersTool(GatewayToolClient g) : GetTool(g)
{
    public override string Name => "purchase_list_orders";
    public override string Description => "List purchase orders — vendor, status, totals. Use for questions about procurement and purchasing.";
    public override string Agent => "purchase";
    public override string? RequiredPermission => "purchase.orders.view";
    protected override string Path => "api/purchase/orders";
}
