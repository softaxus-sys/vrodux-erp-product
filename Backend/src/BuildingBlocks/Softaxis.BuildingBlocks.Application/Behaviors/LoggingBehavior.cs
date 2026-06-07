using MediatR;
using Microsoft.Extensions.Logging;

namespace Softaxis.BuildingBlocks.Application.Behaviors;

/// <summary>
/// Logs every command/query with timing.
/// Slow queries (> 500ms) are logged as warnings.
/// </summary>
public sealed class LoggingBehavior<TRequest, TResponse>(
    ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private const int SlowRequestThresholdMs = 500;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        logger.LogInformation("[START] {Request}", requestName);

        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var response = await next(cancellationToken);
            sw.Stop();

            if (sw.ElapsedMilliseconds > SlowRequestThresholdMs)
                logger.LogWarning("[SLOW] {Request} took {Elapsed}ms", requestName, sw.ElapsedMilliseconds);
            else
                logger.LogInformation("[END] {Request} completed in {Elapsed}ms", requestName, sw.ElapsedMilliseconds);

            return response;
        }
        catch (Exception ex)
        {
            sw.Stop();
            logger.LogError(ex, "[ERROR] {Request} failed after {Elapsed}ms", requestName, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
