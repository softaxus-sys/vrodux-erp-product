using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.License.Dtos;

namespace Softaxis.Identity.Application.License.Queries.ValidateLicenseKey;

/// <summary>Super-admin: validate any license key string.</summary>
public sealed record ValidateLicenseKeyQuery(string LicenseKey) : IQuery<LicenseValidationDto>;
