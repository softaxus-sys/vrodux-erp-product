using MediatR;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.BuildingBlocks.Application.CQRS;

/// <summary>Command that returns a Result (no value payload).</summary>
public interface ICommand : IRequest<Result>;

/// <summary>Command that returns a typed Result.</summary>
public interface ICommand<TResponse> : IRequest<Result<TResponse>>;

/// <summary>Command handler — no value payload.</summary>
public interface ICommandHandler<TCommand> : IRequestHandler<TCommand, Result>
    where TCommand : ICommand;

/// <summary>Command handler — with value payload.</summary>
public interface ICommandHandler<TCommand, TResponse> : IRequestHandler<TCommand, Result<TResponse>>
    where TCommand : ICommand<TResponse>;
