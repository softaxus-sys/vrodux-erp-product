namespace Softaxis.HR.Application.Payroll.Dtos;

/// <summary>The employer identifiers a WPS salary file carries. Never guessed — MOHRE matches them.</summary>
public sealed record WpsConfigurationDto(
    string EmployerUniqueId,
    string EmployerBankRoutingCode,
    int    FileSequence,
    bool   IsComplete);

/// <summary>One employee who cannot be included in the file yet, and why.</summary>
public sealed record WpsIssueDto(string EmployeeName, string Problem);

/// <summary>
/// The result of asking for a salary file.
///
/// <para>Returns the issues alongside the file rather than instead of it. A payroll officer needs
/// to see that four people are missing a labour card number <b>before</b> the bank rejects the
/// submission, and blocking the download entirely over one incomplete record would be worse: the
/// rest of the payroll is still payable.</para>
/// </summary>
public sealed record WpsSifFileDto(
    string  FileName,
    string  Content,
    int     RecordCount,
    decimal TotalSalary,
    int     ExcludedCount,
    IReadOnlyList<WpsIssueDto> Issues);
