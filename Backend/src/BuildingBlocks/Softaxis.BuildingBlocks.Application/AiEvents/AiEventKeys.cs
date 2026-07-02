namespace Softaxis.BuildingBlocks.Application.AiEvents;

/// <summary>
/// Canonical AI event keys. Producers reference these constants when publishing so the strings stay
/// consistent with what the AI Assistant service offers as automation triggers. Dotted convention:
/// "&lt;module&gt;.&lt;entity&gt;.&lt;action&gt;".
/// </summary>
public static class AiEventKeys
{
    public const string CrmLeadCreated       = "crm.lead.created";
    public const string CrmCustomerCreated   = "crm.customer.created";
    public const string CrmDealWon           = "crm.deal.won";
    public const string SalesOrderCreated    = "sales.order.created";
    public const string FinanceInvoiceCreated = "finance.invoice.created";
    public const string PurchaseOrderReceived = "purchase.order.received";
}
