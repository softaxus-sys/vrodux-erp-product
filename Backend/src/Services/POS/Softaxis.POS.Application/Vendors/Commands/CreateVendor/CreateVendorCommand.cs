using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Vendors.Commands.CreateVendor;

public sealed record CreateVendorCommand(
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
    string?  Notes)
    : ICommand<VendorDto>;
