using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.LeadGen.Application.Reports;

public sealed record FunnelDto(int Discovered, int Revealed, int Contacted, int Replied, int Qualified, int Converted);

public sealed record DayPointDto(string Date, int Sent, int Replies, int Bounces);

public sealed record CampaignRowDto(Guid Id, string Name, string Status, int Recipients, int Sent, int Replies,
    double ReplyRatePercent, int Bounced, int Interested);

public sealed record SourceRowDto(Guid SearchId, string Name, int Found, int Revealed, int Replied, int Converted,
    int CreditsSpent, double CostPerReply);

public sealed record DashboardDto(
    long Balance, int Days, FunnelDto Funnel, int Sent, int Replies, int Bounces, int Interested,
    double ReplyRatePercent, double BounceRatePercent, int CreditsSpent, int CreditsRefunded,
    int ActiveCampaigns, int UnreadReplies, int ConnectedMailboxes, int PausedMailboxes,
    IReadOnlyList<DayPointDto> Series, IReadOnlyList<CampaignRowDto> Campaigns, IReadOnlyList<SourceRowDto> Sources,
    IReadOnlyList<string> Attention);

public sealed record GetDashboardQuery(int Days = 30) : IQuery<DashboardDto>;
