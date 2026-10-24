using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Platforms;

public sealed record PlatformConnectionDto(
    Guid Id, string Platform, string Environment, Guid BranchId, string RemoteId, string? Username,
    bool PasswordSet, bool PluginSecretSet, bool AutoAccept, int DefaultPrepMinutes, bool IsEnabled,
    /// <summary>The address to give Foodpanda as the "POS plugin" base URL.</summary>
    string PluginBaseUrl, DateTime? LastOrderAt, string? LastError);

public sealed record GetPlatformConnectionsQuery : IQuery<IReadOnlyList<PlatformConnectionDto>>;

/// <summary>Creates (Id null) or updates a connection. Null password / secret keeps what is stored.</summary>
public sealed record SavePlatformConnectionCommand(
    Guid? Id, string Platform, string Environment, Guid BranchId, string RemoteId, string? Username,
    string? Password, string? PluginSecret, bool AutoAccept, int DefaultPrepMinutes, bool IsEnabled)
    : ICommand<PlatformConnectionDto>;

public sealed class SavePlatformConnectionValidator : AbstractValidator<SavePlatformConnectionCommand>
{
    public SavePlatformConnectionValidator()
    {
        RuleFor(x => x.Platform).Equal("foodpanda").WithMessage("Only Foodpanda is supported.");
        RuleFor(x => x.BranchId).NotEmpty().WithMessage("Choose the branch these orders go to.");
        RuleFor(x => x.RemoteId).NotEmpty().MaximumLength(100).WithMessage("Enter the vendor (remote) id Foodpanda gave this branch.");
        RuleFor(x => x.Username).MaximumLength(200);
        RuleFor(x => x.DefaultPrepMinutes).InclusiveBetween(5, 180);
    }
}

public sealed record DeletePlatformConnectionCommand(Guid Id) : ICommand;

public sealed record PlatformTestResultDto(bool Ok, string Message);
/// <summary>Signs in to Foodpanda with the stored username and password.</summary>
public sealed record TestPlatformConnectionCommand(Guid Id) : ICommand<PlatformTestResultDto>;

/// <summary>An order posted by Foodpanda to our plugin address. Anonymous; authenticated by the
/// inbound key in the URL plus the plugin secret in the Authorization header.</summary>
public sealed record IngestPlatformOrderCommand(string InboundKey, string RemoteId, string Body, string? Authorization)
    : ICommand<IngestPlatformOrderResult>;
public sealed record IngestPlatformOrderResult(Guid OrderId, bool Duplicate);

/// <summary>Foodpanda telling us an order changed on their side (e.g. cancelled by the customer).</summary>
public sealed record PlatformOrderStatusCommand(string InboundKey, string RemoteId, string RemoteOrderId, string Body, string? Authorization)
    : ICommand;

public sealed record AcceptPlatformOrderCommand(Guid OrderId, int? PrepMinutes) : IOrderScopedCommand, ICommand<OrderDto>;
public sealed record RejectPlatformOrderCommand(Guid OrderId, string Reason, string? Message) : IOrderScopedCommand, ICommand<OrderDto>;
/// <summary>The rider collected the order: tells Foodpanda and closes the bill as paid by Foodpanda.</summary>
public sealed record HandOverPlatformOrderCommand(Guid OrderId) : IOrderScopedCommand, ICommand<OrderDto>;
