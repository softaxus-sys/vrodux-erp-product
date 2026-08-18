using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Exceptions;

namespace Softaxis.BuildingBlocks.Infrastructure.Middleware;

/// <summary>
/// Global exception handler — translates unhandled exceptions to RFC 7807 Problem Details.
/// Validation and domain exceptions are returned as 400/422; everything else is 500.
/// </summary>
public sealed class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented        = false,
    };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (status, title, detail) = exception switch
        {
            DomainException de =>
                (HttpStatusCode.UnprocessableEntity, "Domain Rule Violation", de.Message),
            UnauthorizedAccessException =>
                (HttpStatusCode.Unauthorized, "Unauthorized", "Authentication is required."),
            _ =>
                (HttpStatusCode.InternalServerError, "Server Error", "An unexpected error occurred."),
        };

        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode  = (int)status;

        var problem = new
        {
            type     = $"https://erp.vrodux.com/errors/{(int)status}",
            title,
            status   = (int)status,
            detail,
            traceId  = context.TraceIdentifier,
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(problem, JsonOptions));
    }
}
