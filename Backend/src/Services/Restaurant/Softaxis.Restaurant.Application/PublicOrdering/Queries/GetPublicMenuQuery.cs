using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.PublicOrdering.Dtos;

namespace Softaxis.Restaurant.Application.PublicOrdering.Queries;

/// <summary>GET /api/restaurant/public-menu/{qrCode} — anonymous, tenant resolved from the QR token.</summary>
public sealed record GetPublicMenuQuery(string QrCode) : IQuery<PublicMenuDto>;
