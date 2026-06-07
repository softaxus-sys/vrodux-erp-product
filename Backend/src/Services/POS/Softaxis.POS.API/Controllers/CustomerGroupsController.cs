using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.MasterData.CustomerGroups.Commands;
using Softaxis.POS.Application.MasterData.CustomerGroups.Queries;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/customer-groups")]
public sealed class CustomerGroupsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get all customer groups.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCustomerGroupsQuery(), ct));

    /// <summary>Create (Id null) or update (Id set) a customer group.</summary>
    [HttpPut]
    public async Task<IActionResult> Upsert(
        [FromBody] UpsertCustomerGroupCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>Soft-delete a customer group. System groups cannot be deleted.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeleteCustomerGroupCommand(id), ct));
}
