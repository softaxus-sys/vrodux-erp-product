using System.Linq.Expressions;
using FluentValidation;
using Softaxis.Finance.Application.UaeVat;

namespace Softaxis.Finance.Application.Customers.Commands;

/// <summary>Shared rules for a customer's tax identity, so create and update cannot drift.</summary>
internal static class CustomerTaxRules
{
    public static void Apply<T>(AbstractValidator<T> v,
        Expression<Func<T, string?>> trn, Expression<Func<T, string?>> emirate,
        Expression<Func<T, string?>> country, Expression<Func<T, string?>> city,
        Expression<Func<T, string?>> peppol)
    {
        var countryOf = country.Compile();
        bool IsUae(T x) { var c = countryOf(x); return string.IsNullOrWhiteSpace(c) || c.Trim().Equals("AE", StringComparison.OrdinalIgnoreCase); }

        v.RuleFor(country).Matches("^[A-Za-z]{2}$").WithMessage("Country must be a 2-letter ISO code, e.g. AE.")
            .When(x => !string.IsNullOrWhiteSpace(countryOf(x)));
        // Only a UAE TRN has a known shape; a foreign VAT number is accepted as typed.
        v.RuleFor(trn).Must(t => UaeVatReturnBuilder.IsValidTrn(t!.Replace(" ", "")))
            .WithMessage("A UAE TRN is 15 digits starting with 100.")
            .When(x => !string.IsNullOrWhiteSpace(trn.Compile()(x)) && IsUae(x));
        v.RuleFor(trn).MaximumLength(50);
        v.RuleFor(emirate).Must(e => UaeVatReturnBuilder.Emirates.ContainsKey(e!.Trim().ToUpperInvariant()))
            .WithMessage("Emirate must be one of AUH, DXB, SHJ, AJM, UAQ, RAK, FUJ.")
            .When(x => !string.IsNullOrWhiteSpace(emirate.Compile()(x)));
        v.RuleFor(city).MaximumLength(100);
        v.RuleFor(peppol).MaximumLength(100);
    }
}
