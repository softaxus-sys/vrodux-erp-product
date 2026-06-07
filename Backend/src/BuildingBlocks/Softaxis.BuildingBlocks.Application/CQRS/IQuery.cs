using MediatR;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.BuildingBlocks.Application.CQRS;

/// <summary>Query that returns a typed Result. Queries must NOT mutate state.</summary>
public interface IQuery<TResponse> : IRequest<Result<TResponse>>;

/// <summary>Query handler.</summary>
public interface IQueryHandler<TQuery, TResponse> : IRequestHandler<TQuery, Result<TResponse>>
    where TQuery : IQuery<TResponse>;
