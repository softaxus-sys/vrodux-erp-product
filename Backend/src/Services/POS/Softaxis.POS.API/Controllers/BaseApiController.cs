using MediatR;
using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.API.Models;

namespace Softaxis.POS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class BaseApiController(ISender sender) : ControllerBase
{
    protected ISender Sender { get; } = sender;

    protected IActionResult HandleResult<T>(Result<T> result, int successCode = 200)
    {
        if (result.IsSuccess)
        {
            return successCode switch
            {
                201 => StatusCode(201, ApiResponse<T>.Ok(result.Value)),
                204 => NoContent(),
                _   => Ok(ApiResponse<T>.Ok(result.Value))
            };
        }

        var error = result.Error;
        return error.Code switch
        {
            var c when c.EndsWith(".NotFound")       => NotFound(ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c.EndsWith(".Forbidden")      => StatusCode(403, ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c.EndsWith(".Unauthorized")   => Unauthorized(ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c == "Validation.Failed"      => BadRequest(ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c.EndsWith(".Taken")          => Conflict(ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c.EndsWith(".InUse")          => Conflict(ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c.EndsWith(".HasChildren")    => Conflict(ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c.EndsWith(".NotOpen")        => UnprocessableEntity(ApiResponse<T>.Fail(error.Description, error.Code)),
            var c when c.EndsWith(".InsufficientStock") => UnprocessableEntity(ApiResponse<T>.Fail(error.Description, error.Code)),
            _                                        => BadRequest(ApiResponse<T>.Fail(error.Description, error.Code))
        };
    }

    protected IActionResult HandleResult(Result result)
    {
        if (result.IsSuccess)
            return NoContent();

        var error = result.Error;
        return error.Code switch
        {
            var c when c.EndsWith(".NotFound")   => NotFound(new { error.Code, error.Description }),
            var c when c.EndsWith(".Forbidden")  => StatusCode(403, new { error.Code, error.Description }),
            var c when c == "Validation.Failed"  => BadRequest(new { error.Code, error.Description }),
            var c when c.EndsWith(".InUse")      => Conflict(new { error.Code, error.Description }),
            _                                    => BadRequest(new { error.Code, error.Description })
        };
    }
}
