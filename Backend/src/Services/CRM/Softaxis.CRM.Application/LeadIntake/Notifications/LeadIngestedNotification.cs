using MediatR;

namespace Softaxis.CRM.Application.LeadIntake.Notifications;

/// <summary>
/// Raised by the intake pipeline after a lead is created from an external source.
/// Automations (task creation, email/SMS/WhatsApp, outbound webhook, workflows) subscribe
/// as <see cref="INotificationHandler{T}"/>s — adding an automation never touches intake.
///
/// Published explicitly by the intake service (CrmDbContext does not auto-dispatch domain
/// events), in-process and synchronously, after the lead is committed.
/// </summary>
public sealed record LeadIngestedNotification(
    Guid TenantId,
    Guid LeadId,
    Guid? IntegrationId,
    string ProviderKey,
    string LeadName,
    string? Email,
    string? Phone,
    string AssignedTo) : INotification;
