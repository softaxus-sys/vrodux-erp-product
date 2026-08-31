using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.RentAlerts.Dtos;

namespace Softaxis.RealEstate.Application.RentAlerts.Queries;

public sealed record GetRentAlertSettingsQuery : IQuery<RentAlertSettingsDto>;

public sealed record GetRentAlertLogsQuery(Guid? ContractId = null, int Limit = 100)
    : IQuery<IReadOnlyList<RentAlertLogDto>>;

public sealed record GetExpiringContractsQuery(int WithinDays = 90)
    : IQuery<IReadOnlyList<ExpiringContractDto>>;
