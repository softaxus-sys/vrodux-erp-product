using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Support.API.Controllers.Common;

/// <summary>Converts Result/Result&lt;T&gt; to HTTP responses (same contract as every other
/// service's ControllerBase).</summary>
[ApiController]
public abstract class SupportControllerBase : ControllerBase
{
    protected IActionResult OkOrError<T>(Result<T> result) =>
        result.IsSuccess ? Ok(result.Value) : ErrorResponse(result.Error);

    protected IActionResult CreatedOrError<T>(Result<T> result, string actionName, object routeValues) =>
        result.IsSuccess
            ? CreatedAtAction(actionName, routeValues, result.Value)
            : ErrorResponse(result.Error);

    protected IActionResult NoContentOrError(Result result) =>
        result.IsSuccess ? NoContent() : ErrorResponse(result.Error);

    private ObjectResult ErrorResponse(Error error)
    {
        var body = new { error.Code, error.Description };

        return error.Code switch
        {
            var c when c.EndsWith(".NotFound")          => NotFound(body),
            var c when c.EndsWith(".Duplicate")         => Conflict(body),
            var c when c.EndsWith(".Conflict")          => Conflict(body),
            var c when c.EndsWith(".Forbidden")         => StatusCode(StatusCodes.Status403Forbidden, body),
            var c when c.EndsWith(".InvalidTransition") => BadRequest(body),
            "Validation.Failed"                          => UnprocessableEntity(body),
            // Support.NoTenant / Support.Unresolved — the caller's own identity/context is the
            // problem, not the server; these are client-side conditions, not 500s.
            var c when c.StartsWith("Support.")          => BadRequest(body),
            _ => StatusCode(StatusCodes.Status500InternalServerError, body),
        };
    }
}
