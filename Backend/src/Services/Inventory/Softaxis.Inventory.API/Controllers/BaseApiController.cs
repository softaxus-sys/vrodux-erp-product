using MediatR;
using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.API.Models;

namespace Softaxis.Inventory.API.Controllers;

[ApiController]
[Route("api/inventory/[controller]")]
[Produces("application/json")]
public abstract class BaseApiController(ISender sender) : ControllerBase
{
    protected ISender Sender { get; } = sender;

    protected IActionResult HandleResult<T>(Result<T> result, int successCode = 200)
    {
        if (result.IsSuccess)
        {
            var response = ApiResponse<T>.Ok(result.Value);
            return successCode == 201 ? StatusCode(201, response) : Ok(response);
        }

        return result.Error.Code switch
        {
            var c when c.EndsWith(".NotFound")                           => NotFound(ApiResponse<T>.Fail(result.Error.Code, result.Error.Description)),
            var c when c.Contains(".Taken") || c.Contains(".InUse") ||
                       c.Contains(".Conflict")                           => Conflict(ApiResponse<T>.Fail(result.Error.Code, result.Error.Description)),
            _                                                            => BadRequest(ApiResponse<T>.Fail(result.Error.Code, result.Error.Description)),
        };
    }

    protected IActionResult HandleResult(Result result)
    {
        if (result.IsSuccess) return Ok(ApiResponse.Ok());

        return result.Error.Code switch
        {
            var c when c.EndsWith(".NotFound")                           => NotFound(ApiResponse.Fail(result.Error.Code, result.Error.Description)),
            var c when c.Contains(".Taken") || c.Contains(".InUse") ||
                       c.Contains(".Conflict")                           => Conflict(ApiResponse.Fail(result.Error.Code, result.Error.Description)),
            _                                                            => BadRequest(ApiResponse.Fail(result.Error.Code, result.Error.Description)),
        };
    }
}
