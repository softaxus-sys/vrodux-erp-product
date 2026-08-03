using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
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
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCustomersQuery(page, pageSize, search), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCustomerByIdQuery(id), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct), successCode: 201);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerCommand cmd, CancellationToken ct = default)
    {
        if (id != cmd.Id) return BadRequest("ID mismatch.");
        return HandleResult(await Sender.Send(cmd, ct));
    }

    /// <summary>GET /api/customers/{id}/wallet-transactions</summary>
    [HttpGet("{id:guid}/wallet-transactions")]
    [RequirePermission("pos.customers.view")]
    public async Task<IActionResult> GetWalletTransactions(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetWalletTransactionsQuery(id), ct));

    /// <summary>POST /api/customers/{id}/wallet/topup</summary>
    [HttpPost("{id:guid}/wallet/topup")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> TopUpWallet(Guid id, [FromBody] TopUpWalletRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new TopUpWalletCommand(id, req.Amount, req.Notes), ct));

    /// <summary>PUT /api/customers/{id}/credit-limit</summary>
    [HttpPut("{id:guid}/credit-limit")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> SetCreditLimit(Guid id, [FromBody] SetCreditLimitRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new SetCreditLimitCommand(id, req.CreditLimit), ct));

    /// <summary>POST /api/customers/{id}/house-account/payment</summary>
    [HttpPost("{id:guid}/house-account/payment")]
    [RequirePermission("pos.customers.edit")]
    public async Task<IActionResult> RecordHouseAccountPayment(Guid id, [FromBody] RecordHouseAccountPaymentRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new RecordHouseAccountPaymentCommand(id, req.Amount, req.Notes), ct));

    public sealed record TopUpWalletRequest(decimal Amount, string? Notes);
    public sealed record SetCreditLimitRequest(decimal CreditLimit);
    public sealed record RecordHouseAccountPaymentRequest(decimal Amount, string? Notes);
}
