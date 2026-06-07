using FluentValidation;
using MediatR;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.BuildingBlocks.Application.Behaviors;

/// <summary>
/// MediatR pipeline behavior that runs FluentValidation before the handler.
/// Aggregates all validation failures into a single result failure.
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!validators.Any()) return await next(cancellationToken);

        var context = new ValidationContext<TRequest>(request);

        var failures = validators
            .Select(v => v.Validate(context))
            .SelectMany(r => r.Errors)
            .Where(f => f is not null)
            .ToList();

        if (failures.Count == 0) return await next(cancellationToken);

        // Build a structured validation error message
        var message = string.Join(" | ", failures.Select(f => $"{f.PropertyName}: {f.ErrorMessage}"));
        var error   = Error.Custom("Validation.Failed", message);

        // Attempt to cast to Result<T> or Result
        if (typeof(TResponse) == typeof(Result))
            return (TResponse)(object)Result.Failure(error);

        var resultType = typeof(TResponse).GetGenericArguments().FirstOrDefault();
        if (resultType is not null)
        {
            var failureMethod = typeof(Result)
                .GetMethod(nameof(Result.Failure), 1, [typeof(Error)])!
                .MakeGenericMethod(resultType);
            return (TResponse)failureMethod.Invoke(null, [error])!;
        }

        throw new ValidationException(failures);
    }
}
