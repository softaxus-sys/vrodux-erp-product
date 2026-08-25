using System.Globalization;
using System.Text;

namespace Softaxis.HR.Domain.Entities;

/// <summary>One employee's line in a salary file, already resolved from employee + payslip.</summary>
public sealed record WpsSalaryLine(
    string  EmployeeName,
    string? LabourCardNumber,
    string? BankRoutingCode,
    string? Iban,
    decimal FixedIncome,
    decimal VariableIncome,
    int     DaysOnLeave = 0);

/// <summary>A reason one employee cannot be included, named so it can be fixed.</summary>
public sealed record WpsValidationError(string EmployeeName, string Problem);

public sealed record WpsSifResult(string FileName, string Content, int RecordCount, decimal TotalSalary);

/// <summary>
/// Builds a UAE Wage Protection System salary file (SIF).
///
/// <para><b>Format.</b> Comma-separated, one record per line, CRLF-terminated: an <c>SDR</c> row
/// per employee followed by a single <c>EDR</c> employer row that totals them. Amounts are decimal
/// AED with two places — <b>not</b> fils — dates are <c>YYYY-MM-DD</c>, and the salary month is
/// <c>MM-YYYY</c>.</para>
///
/// <para><b>This replaces a fabricated file.</b> The previous export was pipe-delimited, wrote the
/// literals "MOB" and "COMPANY" where the MOHRE establishment and routing codes belong, used the
/// internal employee number as the Employee Unique ID, expressed amounts in fils, and emitted a
/// trailing "EOS" record that is not part of the format. No agent bank would have accepted it.</para>
///
/// <para><b>Verify against your agent's template before the first live submission.</b> The record
/// structure below is the published MOHRE layout, but individual banks and exchange houses issue
/// their own SIF templates and some differ in optional trailing fields. This builder is the shape
/// to check, not an authority to trust blindly.</para>
/// </summary>
public static class WpsSifBuilder
{
    /// <summary>
    /// Checks a line the way the agent will. Returns every problem for one employee rather than
    /// the first, so a payroll officer fixes the record once instead of resubmitting repeatedly.
    /// </summary>
    public static IEnumerable<WpsValidationError> Validate(WpsSalaryLine line)
    {
        if (string.IsNullOrWhiteSpace(line.LabourCardNumber))
            yield return new(line.EmployeeName, "No labour card number (MOHRE Person ID).");
        else if (line.LabourCardNumber.Length is < 10 or > 14)
            yield return new(line.EmployeeName, $"Labour card number is {line.LabourCardNumber.Length} digits; MOHRE issues 14.");

        if (string.IsNullOrWhiteSpace(line.Iban))
            yield return new(line.EmployeeName, "No IBAN on file.");
        else if (!IsUaeIban(line.Iban))
            yield return new(line.EmployeeName, $"IBAN '{line.Iban}' is not a valid UAE IBAN (AE + 21 digits).");

        if (string.IsNullOrWhiteSpace(line.BankRoutingCode))
            yield return new(line.EmployeeName, "No bank routing code (the agent's 9-digit code).");

        if (line.FixedIncome + line.VariableIncome <= 0)
            yield return new(line.EmployeeName, "Net salary is zero.");
    }

    /// <summary>
    /// UAE IBANs are AE + 2 check digits + 3-digit bank code + 16-digit account = 23 characters.
    /// Length and shape only; the mod-97 check below is what actually catches a typo.
    /// </summary>
    public static bool IsUaeIban(string iban)
    {
        var v = iban.Replace(" ", "").ToUpperInvariant();
        if (v.Length != 23 || !v.StartsWith("AE", StringComparison.Ordinal)) return false;
        if (!v.Skip(2).All(char.IsDigit)) return false;
        return Mod97(v) == 1;
    }

    /// <summary>ISO 13616 check: move the first four characters to the end, letters to numbers, mod 97.</summary>
    private static int Mod97(string iban)
    {
        var rearranged = iban[4..] + iban[..4];
        var remainder = 0;
        foreach (var c in rearranged)
        {
            var value = char.IsDigit(c) ? c - '0' : c - 'A' + 10;
            remainder = value > 9 ? (remainder * 100 + value) % 97 : (remainder * 10 + value) % 97;
        }
        return remainder;
    }

    /// <param name="salaryMonth">The payroll period as "yyyy-MM".</param>
    /// <param name="generatedAtLocal">
    /// File creation stamp in the employer's own timezone. UTC would put a file created after 8pm
    /// Gulf time on the following day, which the agent reads as a future-dated file.
    /// </param>
    public static WpsSifResult Build(
        WpsConfiguration config,
        string salaryMonth,
        IReadOnlyList<WpsSalaryLine> lines,
        DateTime generatedAtLocal,
        int sequence)
    {
        var (year, month) = ParsePeriod(salaryMonth);
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var periodStart = new DateTime(year, month, 1);
        var periodEnd   = new DateTime(year, month, daysInMonth);

        var sb = new StringBuilder();
        decimal total = 0;

        // SDR — one Salary Detail Record per employee, before the employer record.
        foreach (var l in lines)
        {
            var amount = l.FixedIncome + l.VariableIncome;
            total += amount;

            sb.Append("SDR").Append(',')
              .Append(l.LabourCardNumber).Append(',')
              .Append(l.BankRoutingCode).Append(',')
              .Append(l.Iban?.Replace(" ", "").ToUpperInvariant()).Append(',')
              .Append(Date(periodStart)).Append(',')
              .Append(Date(periodEnd)).Append(',')
              .Append(daysInMonth).Append(',')
              .Append(Amount(l.FixedIncome)).Append(',')
              .Append(Amount(l.VariableIncome)).Append(',')
              .Append(l.DaysOnLeave)
              .Append("\r\n");
        }

        // EDR — a single Employer Detail Record closing the file and totalling the SDRs above.
        sb.Append("EDR").Append(',')
          .Append(config.EmployerUniqueId).Append(',')
          .Append(config.EmployerBankRoutingCode).Append(',')
          .Append(Date(generatedAtLocal)).Append(',')
          .Append(generatedAtLocal.ToString("HH:mm", CultureInfo.InvariantCulture)).Append(',')
          .Append(month.ToString("00", CultureInfo.InvariantCulture)).Append('-').Append(year).Append(',')
          .Append(lines.Count).Append(',')
          .Append(Amount(total)).Append(',')
          .Append("AED")
          .Append("\r\n");

        // Agents identify a submission by filename: establishment, salary month, then a sequence
        // so a corrected resubmission never collides with one already processed.
        var fileName =
            $"{config.EmployerUniqueId}{month:00}{year % 100:00}{sequence:00}.SIF";

        return new WpsSifResult(fileName, sb.ToString(), lines.Count, total);
    }

    private static (int Year, int Month) ParsePeriod(string period)
    {
        var parts = (period ?? string.Empty).Split('-');
        if (parts.Length >= 2
            && int.TryParse(parts[0], out var y)
            && int.TryParse(parts[1], out var m)
            && m is >= 1 and <= 12)
            return (y, m);

        var now = DateTime.UtcNow;
        return (now.Year, now.Month);
    }

    private static string Date(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>Two decimal places, invariant — a comma decimal separator would split the record.</summary>
    private static string Amount(decimal v) => v.ToString("0.00", CultureInfo.InvariantCulture);
}
