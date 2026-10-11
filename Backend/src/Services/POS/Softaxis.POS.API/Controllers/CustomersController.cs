using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.Customers.Commands.AdjustLoyaltyPoints;
using Softaxis.POS.Application.Customers.Credit;
using Softaxis.POS.Application.Customers.Credit.Reminders;
using Softaxis.POS.Application.Customers.Commands.CreateCustomer;
using Softaxis.POS.Application.Customers.Commands.RecordHouseAccountPayment;
using Softaxis.POS.Application.Customers.Commands.SetCreditLimit;
using Softaxis.POS.Application.Customers.Commands.TopUpWallet;
using Softaxis.POS.Application.Customers.Commands.UpdateCustomer;
using Softaxis.POS.Application.Customers.Queries.GetCustomerById;
using Softaxis.POS.Application.Customers.Queries.GetCustomers;
using Softaxis.POS.Application.Customers.Queries.GetWalletTransactions;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class CustomersController(ISender sender) : BaseApiController(sender)
{
    // A till operator must be able to find a customer to attach to a sale (loyalty, house account,
    // wallet), and the Cashier tier deliberately holds no pos.customers key — so the sale
    // permission also opens the lookup. The wallet / credit-limit endpoints below stay strict.
    [RequireAnyPermission("pos.customers.view", "pos.transactions.create")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCustomersQuery(page, pageSize, search), ct));

    [RequireAnyPermission("pos.customers.view", "pos.transactions.create")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCustomerByIdQuery(id), ct));

    // Registering a walk-in customer at the till is ordinary cashier work.
    [RequireAnyPermission("pos.customers.edit", "pos.transactions.create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct), successCode: 201);

    [RequirePermission("pos.customers.edit")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerCommand cmd, CancellationToken ct = default)
    {
        if (id != cmd.Id) return BadRequest("ID mismatch.");
        return HandleResult(await Sender.Send(cmd, ct));
    }

    /// <summary>GET /api/customers/{id}/wallet-transactions</summary>
    [HttpGet("{id:guid}/wallet-transactions")]
    [RequirePermission("pos.customers.view")]
    public async Task<IActionResult> GetWalletTransactions(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetWalletTransactionsQuery(id, page, pageSize), ct));

    /// <summary>POST /api/customers/{id}/wallet/topup</summary>
    [HttpPost("{id:guid}/wallet/topup")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> TopUpWallet(Guid id, [FromBody] TopUpWalletRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new TopUpWalletCommand(id, req.Amount, req.Notes, req.PaymentMethod), ct));

    /// <summary>PUT /api/customers/{id}/credit-limit</summary>
    [HttpPut("{id:guid}/credit-limit")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> SetCreditLimit(Guid id, [FromBody] SetCreditLimitRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new SetCreditLimitCommand(id, req.CreditLimit), ct));

    /// <summary>GET /api/customers/{id}/credit — the customer's credit account: what they owe, what is late, and the history.
    /// Open to the till too, so a cashier can see a customer's standing before selling on credit.</summary>
    [RequireAnyPermission("pos.customers.view", "pos.transactions.create")]
    [HttpGet("{id:guid}/credit")]
    public async Task<IActionResult> GetCredit(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCustomerCreditQuery(id), ct));

    /// <summary>GET /api/customers/credit/overview — every customer's credit position for the shop.</summary>
    [RequirePermission("pos.customers.view")]
    [HttpGet("credit/overview")]
    public async Task<IActionResult> GetCreditOverview(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCreditOverviewQuery(), ct));

    // ── Credit reminder emails ────────────────────────────────────────────────

    [RequirePermission("pos.customers.view")]
    [HttpGet("credit/reminders/settings")]
    public async Task<IActionResult> GetReminderSettings(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCreditReminderSettingsQuery(), ct));

    [RequirePermission("pos.customers.edit")]
    [HttpPut("credit/reminders/settings")]
    public async Task<IActionResult> UpdateReminderSettings([FromBody] UpdateCreditReminderSettingsCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>POST api/customers/credit/reminders/run?dryRun=true — preview or send the automatic reminders now.</summary>
    [RequirePermission("pos.customers.edit")]
    [HttpPost("credit/reminders/run")]
    public async Task<IActionResult> RunReminders([FromQuery] bool dryRun = true, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new RunCreditRemindersCommand(dryRun), ct));

    [RequirePermission("pos.customers.view")]
    [HttpGet("credit/reminders/log")]
    public async Task<IActionResult> GetReminderLog([FromQuery] Guid? customerId = null, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCreditReminderLogQuery(customerId), ct));

    [RequirePermission("pos.customers.edit")]
    [HttpPost("{id:guid}/credit/remind")]
    public async Task<IActionResult> RemindCustomer(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new SendCustomerCreditReminderCommand(id), ct));

    [HttpPut("{id:guid}/credit-terms")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> SetCreditTerms(Guid id, [FromBody] SetCreditTermsRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new SetCreditTermsCommand(id, req.Days), ct));

    [HttpPut("{id:guid}/credit-hold")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> SetCreditHold(Guid id, [FromBody] SetCreditHoldRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new SetCreditHoldCommand(id, req.Hold, req.Reason), ct));

    /// <summary>POST /api/customers/{id}/house-account/payment</summary>
    [HttpPost("{id:guid}/house-account/payment")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> RecordHouseAccountPayment(Guid id, [FromBody] RecordHouseAccountPaymentRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new RecordHouseAccountPaymentCommand(id, req.Amount, req.Notes, req.PaymentMethod), ct));

    /// <summary>POST /api/customers/{id}/loyalty/adjust — signed manual correction.</summary>
    [HttpPost("{id:guid}/loyalty/adjust")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> AdjustLoyalty(Guid id, [FromBody] AdjustLoyaltyRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new AdjustLoyaltyPointsCommand(id, req.Points, req.Reason), ct));

    public sealed record AdjustLoyaltyRequest(decimal Points, string? Reason);
    public sealed record TopUpWalletRequest(decimal Amount, string? Notes, string? PaymentMethod);
    public sealed record SetCreditLimitRequest(decimal CreditLimit);
    public sealed record SetCreditTermsRequest(int Days);
    public sealed record SetCreditHoldRequest(bool Hold, string? Reason);
    public sealed record RecordHouseAccountPaymentRequest(decimal Amount, string? Notes, string? PaymentMethod);
}
