using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.Vendors.Commands.UpdateVendor;

public sealed record UpdateVendorCommand(
    Guid     Id,
    string   Name,
    string?  Code,
    string?  Category,
    string?  ContactPerson,
    string?  Email,
    string?  Phone,
    string?  Address,
    string?  TaxNumber,
    string?  PaymentTerms,
    string?  Currency,
    string?  Notes,
    string?  Status,
    decimal? Rating)
    : ICommand;
