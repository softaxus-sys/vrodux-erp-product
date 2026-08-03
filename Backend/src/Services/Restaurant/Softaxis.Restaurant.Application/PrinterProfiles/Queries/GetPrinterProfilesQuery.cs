using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.PrinterProfiles.Dtos;

namespace Softaxis.Restaurant.Application.PrinterProfiles.Queries;

public sealed record GetPrinterProfilesQuery : IQuery<IReadOnlyList<PrinterProfileDto>>;
