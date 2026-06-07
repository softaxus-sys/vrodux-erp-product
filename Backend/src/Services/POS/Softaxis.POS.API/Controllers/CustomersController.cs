using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.Customers.Commands.CreateCustomer;
using Softaxis.POS.Application.Customers.Commands.UpdateCustomer;
using Softaxis.POS.Application.Customers.Queries.GetCustomerById;
using Softaxis.POS.Application.Customers.Queries.GetCustomers;

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
}
