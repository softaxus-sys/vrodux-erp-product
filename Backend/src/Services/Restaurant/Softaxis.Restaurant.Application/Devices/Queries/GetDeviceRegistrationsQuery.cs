using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Devices.Dtos;

namespace Softaxis.Restaurant.Application.Devices.Queries;

/// <summary>GET /api/restaurant/devices?branchId= — admin listing (all, or filtered to one branch).</summary>
public sealed record GetDeviceRegistrationsQuery(Guid? BranchId) : IQuery<IReadOnlyList<DeviceRegistrationDto>>;
