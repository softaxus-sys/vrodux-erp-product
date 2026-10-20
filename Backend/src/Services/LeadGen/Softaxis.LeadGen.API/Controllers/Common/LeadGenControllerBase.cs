using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.LeadGen.API.Controllers.Common;

/// <summary>
/// Base controller for Lead Generation. Converts Result/Result&lt;T&gt; to HTTP responses (same contract
/// as FinanceControllerBase). Note what is deliberately NOT mapped to 401: a refused mailbox login or an
/// expired provider token is a 4xx the user can act on, and a 401 would make the app sign them out.
/// </summary>
[ApiController]
public abstract class LeadGenControllerBase : ControllerBase
{
    protected IActionResult OkOrError<T>(Result<T> result) =>
        result.IsSuccess ? Ok(result.Value) : ErrorResponse(result.Error);

    protected IActionResult NoContentOrError(Result result) =>
        result.IsSuccess ? NoContent() : ErrorResponse(result.Error);

    private ObjectResult ErrorResponse(Error error)
    {
        var body = new { error.Code, error.Description };

        return error.Code switch
        {
            var c when c.EndsWith(".NotFound")      => NotFound(body),
            var c when c.EndsWith(".Forbidden")     => StatusCode(StatusCodes.Status403Forbidden, body),
            var c when c.EndsWith(".Duplicate")     => Conflict(body),
            var c when c.EndsWith(".Conflict")      => Conflict(body),
            var c when c.EndsWith(".Invalid")       => BadRequest(body),
            var c when c.EndsWith(".NotConfigured") => StatusCode(StatusCodes.Status503ServiceUnavailable, body),
            var c when c.EndsWith(".Unavailable")   => StatusCode(StatusCodes.Status503ServiceUnavailable, body),
            "Validation.Failed"                      => UnprocessableEntity(body),
            "Auth.Unresolved"                        => StatusCode(StatusCodes.Status403Forbidden, body),
            _ => StatusCode(StatusCodes.Status500InternalServerError, body),
        };
    }
}
