using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Fixes.Dtos;

namespace Softaxis.Seo.Application.Fixes.Commands;

public sealed record ApproveFixCommand(Guid Id, string? EditedValueJson) : ICommand<FixDto>;
public sealed record RejectFixCommand(Guid Id) : ICommand<FixDto>;
public sealed record RunScanNowCommand(Guid SiteId) : ICommand<RunScanNowResultDto>;
