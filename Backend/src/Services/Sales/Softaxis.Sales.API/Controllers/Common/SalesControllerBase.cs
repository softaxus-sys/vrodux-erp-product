using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Sales.API.Controllers.Common;

/// <summary>
/// Base controller for all Sales API controllers.
/// Converts Result/Result&lt;T&gt; to the appropriate HTTP response without
/// littering every action with if/else boilerplate.
/// </summary>
[ApiController]
public abstract class SalesControllerBase : ControllerBase
{
    /// <summary>200 OK with the result value, or an error response.</summary>
    protected IActionResult OkOrError<T>(Result<T> result) =>
        result.IsSuccess ? Ok(result.Value) : ErrorResponse(result.Error);

    /// <summary>201 Created with location header, or an error response.</summary>
    protected IActionResult CreatedOrError<T>(
        Result<T> result, string actionName, object routeValues) =>
        result.IsSuccess
            ? CreatedAtAction(actionName, routeValues, result.Value)
            : ErrorResponse(result.Error);

    /// <summary>204 No Content on success, or an error response.</summary>
    protected IActionResult NoContentOrError(Result result) =>
        result.IsSuccess ? NoContent() : ErrorResponse(result.Error);

    private ObjectResult ErrorResponse(Error error)
    {
        var body = new { error.Code, error.Description };

        return error.Code switch
        {
            var c when c.EndsWith(".NotFound")       => NotFound(body),
            var c when c.EndsWith(".Duplicate")      => Conflict(body),
            var c when c.EndsWith(".HasTransactions")=> Conflict(body),
            var c when c.EndsWith(".Conflict")       => Conflict(body),
            "Validation.Failed"                      => UnprocessableEntity(body),
            _                                        => StatusCode(StatusCodes.Status500InternalServerError, body),
        };
    }
}
