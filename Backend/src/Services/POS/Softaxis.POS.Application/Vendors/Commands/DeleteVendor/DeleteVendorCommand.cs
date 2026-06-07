using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.Vendors.Commands.DeleteVendor;

public sealed record DeleteVendorCommand(Guid Id) : ICommand;
