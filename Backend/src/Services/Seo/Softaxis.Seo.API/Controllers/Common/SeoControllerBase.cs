using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Seo.API.Controllers.Common;

/// <summary>Converts Result/Result&lt;T&gt; to HTTP responses — same contract as every other
/// service's controller base (FinanceControllerBase, VisaControllerBase, …).</summary>
[ApiController]
public abstract class SeoControllerBase : ControllerBase
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
            var c when c.EndsWith(".NotFound")  => NotFound(body),
            var c when c.EndsWith(".Duplicate") => Conflict(body),
            var c when c.EndsWith(".Conflict")  => Conflict(body),
            "Validation.Failed"                  => UnprocessableEntity(body),
            _ => StatusCode(StatusCodes.Status500InternalServerError, body),
        };
    }
}
