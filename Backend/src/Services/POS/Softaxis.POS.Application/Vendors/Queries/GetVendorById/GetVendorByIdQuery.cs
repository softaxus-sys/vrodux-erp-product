using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Vendors.Queries.GetVendorById;

public sealed record GetVendorByIdQuery(Guid Id) : IQuery<VendorDto>;
