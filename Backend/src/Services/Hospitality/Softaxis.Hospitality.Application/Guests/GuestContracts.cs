using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Hospitality.Application.Bookings.Dtos;

namespace Softaxis.Hospitality.Application.Guests;

public sealed record GuestDto(
    Guid     Id,
    string   FullName,
    string?  Email,
    string?  Phone,
    string?  Nationality,
    string?  DocumentType,
    string?  DocumentNumber,
    string?  DocumentExpiry,
    string?  DateOfBirth,
    string?  Address,
    string?  Company,
    bool     IsVip,
    string?  Notes,
    int      StayCount,
    decimal  TotalSpent,
    string?  LastStayOn,
    DateTime CreatedAt);

public sealed record GuestDetailDto(GuestDto Guest, IReadOnlyList<BookingDto> Bookings);

public sealed record GetGuestsQuery(string? Search = null, int Page = 1, int PageSize = 30) : IQuery<PagedResult<GuestDto>>;

public sealed record GetGuestByIdQuery(Guid Id) : IQuery<GuestDetailDto>;

public sealed record UpsertGuestCommand(
    Guid? Id, string FullName, string? Email, string? Phone, string? Nationality,
    string? DocumentType, string? DocumentNumber, string? DocumentExpiry, string? DateOfBirth,
    string? Address, string? Company, bool IsVip, string? Notes) : ICommand<GuestDto>;

public sealed class UpsertGuestValidator : AbstractValidator<UpsertGuestCommand>
{
    private static bool IsDate(string? s) => string.IsNullOrWhiteSpace(s) || DateOnly.TryParseExact(s, "yyyy-MM-dd", out _);

    public UpsertGuestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("Full name is required.").MaximumLength(200);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("That email address does not look right.");
        RuleFor(x => x.DocumentExpiry).Must(IsDate).WithMessage("Document expiry must be yyyy-MM-dd.");
        RuleFor(x => x.DateOfBirth).Must(IsDate).WithMessage("Date of birth must be yyyy-MM-dd.");
    }
}

public sealed record DeleteGuestCommand(Guid Id) : ICommand;
