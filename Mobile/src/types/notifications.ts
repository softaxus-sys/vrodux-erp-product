/** Mirrors the backend's shared `NotificationDto`/`FeedDto` (`Softaxis.ApiGateway`'s gateway-hosted
 *  `/api/notifications` -- see `Backend/.../ApiGateway/Notifications/NotificationsController.cs`).
 *  This is the cross-module "bell" feed every trigger writes to today (CRM lead/opportunity/account
 *  assignment + supervisor alerts, activity assignment, HR leave/payroll, Purchase requisitions,
 *  Project issue assignment, inbound portal leads, ...) -- NOT the old CRM-only
 *  `/api/crm/notifications` (`CrmNotificationsController`) this file used to mirror, which is dead:
 *  its table stopped being written to once every one of those triggers moved onto the shared
 *  `INotificationDispatcher`. Repointed in the notification-bell fix pass.
 *
 *  This is separate from the Expo push-token path in `lib/push.ts` -- that sends an OS-level push
 *  via `IPushNotificationSender` and is unaffected by any of this; see Mobile/README.md's Push
 *  Notifications section. */
export interface AppNotificationDto {
  id: string;
  /** Module key -- matches the backend's `NotificationModules` (e.g. "crm", "hr", "purchase",
   *  "project-management"). Not surfaced in the UI yet; kept so a per-module filter can be added
   *  without another backend round trip. */
  module: string;
  /** Stable dotted key, e.g. "lead.assigned", "lead.assigned-to-member", "leave.requested". Safe to
   *  switch on; `title` is prose and can change wording without notice. */
  event: string;
  type: string; // info | success | warning | error | mention
  title: string;
  message: string;
  /** App-relative path this would open on web. Not used for in-app navigation here --
   *  `relatedToType`/`relatedToId` is (see NotificationsScreen.tsx + RootNavigator.tsx's
   *  `openLeadDetail`), since mobile's own routes don't match the web app's paths. */
  link: string | null;
  relatedToType: string | null;
  relatedToId: string | null;
  read: boolean;
  createdAt: string;
}

export interface MyNotificationsDto {
  items: AppNotificationDto[];
  /** Unread across EVERY module, so the badge does not drop when the panel is filtered. */
  unreadCount: number;
}

/** Per-module unread counts -- `GET /api/notifications/summary`. Not consumed yet; kept for a
 *  future per-module filter UI. */
export interface ModuleUnreadDto {
  module: string;
  count: number;
}
