using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Notifications.Commands;
using Softaxis.Restaurant.Application.Notifications.Dtos;
using Softaxis.Restaurant.Application.Notifications.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Notifications;

internal sealed class GetNotificationProviderConfigHandler(RestaurantDbContext db)
    : IQueryHandler<GetNotificationProviderConfigQuery, NotificationProviderConfigDto>
{
    public async Task<Result<NotificationProviderConfigDto>> Handle(GetNotificationProviderConfigQuery query, CancellationToken ct)
    {
        var config = await db.NotificationProviderConfigs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Channel == query.Channel, ct);

        // No config saved yet — default shape, matching how Payment Gateway defaults to "manual".
        if (config is null)
            return Result.Success(new NotificationProviderConfigDto(query.Channel, "twilio", false, false, null, false));

        return Result.Success(new NotificationProviderConfigDto(
            config.Channel, config.Provider, config.AccountSidEncrypted != null, config.AuthTokenEncrypted != null,
            config.FromNumber, config.IsEnabled));
    }
}

internal sealed class UpsertNotificationProviderConfigHandler(RestaurantDbContext db, ISecretProtector protector)
    : ICommandHandler<UpsertNotificationProviderConfigCommand, NotificationProviderConfigDto>
{
    public async Task<Result<NotificationProviderConfigDto>> Handle(UpsertNotificationProviderConfigCommand cmd, CancellationToken ct)
    {
        var config = await db.NotificationProviderConfigs.FirstOrDefaultAsync(x => x.Channel == cmd.Channel, ct);
        var isNew = config is null;
        config ??= new NotificationProviderConfig(cmd.Channel, cmd.Provider);

        // null = leave the currently-stored secret unchanged.
        var accountSidEncrypted = cmd.AccountSid is null ? config.AccountSidEncrypted : protector.Protect(cmd.AccountSid);
        var authTokenEncrypted = cmd.AuthToken is null ? config.AuthTokenEncrypted : protector.Protect(cmd.AuthToken);

        config.Configure(accountSidEncrypted, authTokenEncrypted, cmd.FromNumber, cmd.IsEnabled);

        if (isNew) db.NotificationProviderConfigs.Add(config);
        await db.SaveChangesAsync(ct);

        return Result.Success(new NotificationProviderConfigDto(
            config.Channel, config.Provider, config.AccountSidEncrypted != null, config.AuthTokenEncrypted != null,
            config.FromNumber, config.IsEnabled));
    }
}
