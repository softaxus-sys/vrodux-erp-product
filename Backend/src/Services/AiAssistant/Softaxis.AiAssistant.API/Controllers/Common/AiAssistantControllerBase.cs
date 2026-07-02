using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.API.Controllers.Common;

/// <summary>Maps Result/Result&lt;T&gt; to HTTP responses (mirrors the other services' bases).</summary>
[ApiController]
public abstract class AiAssistantControllerBase : ControllerBase
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
            var c when c.EndsWith(".NotFound")     => NotFound(body),
            var c when c.EndsWith(".Duplicate")    => Conflict(body),
            var c when c.EndsWith(".Conflict")     => Conflict(body),
            var c when c.EndsWith(".Invalid")      => BadRequest(body),
            var c when c.EndsWith(".InvalidProvider") => BadRequest(body),
            "Validation.Failed"                    => UnprocessableEntity(body),
            _                                      => StatusCode(StatusCodes.Status500InternalServerError, body),
        };
    }
}
