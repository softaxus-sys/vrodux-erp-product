using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.VisaServices.Application.Channels.Dtos;

namespace Softaxis.VisaServices.Application.Channels.Queries;

public sealed record GetChannelsQuery : IQuery<IReadOnlyList<ChannelDto>>;

public sealed record GetCaseSubmissionsQuery(Guid CaseId) : IQuery<IReadOnlyList<GovtSubmissionDto>>;
