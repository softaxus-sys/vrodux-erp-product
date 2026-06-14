namespace Softaxis.Construction.Application.Sites.Dtos;

public sealed record SiteLocationDto(string Address, string City, string Emirate, string Lat, string Lng);

public sealed record SiteWorkersDto(int Current, int Max);

public sealed record SiteDto(
    Guid Id, string SiteCode, string Name, string ProjectId, string ProjectName,
    SiteLocationDto Location, string SiteManager, string SiteManagerPhone,
    string SafetyOfficer, string SafetyOfficerPhone, string Status, SiteWorkersDto Workers,
    decimal Area, string StartDate, string PermitNumber, string PermitExpiry,
    string LastInspection, string NextInspection, int SafetyScore, string Notes);

public sealed record SitesSummaryDto(
    int Total, int Active, int Inactive, int Completed,
    int TotalWorkers, double AvgSafetyScore, int PermitsExpiringSoon);
