/** Mirrors the backend's `CrmNotificationDto`/`MyNotificationsDto` (Softaxis.CRM.Application) --
 *  the app's one existing per-user "bell" feed today. See Mobile/README.md's Push Notifications
 *  section for why this is reused rather than a new cross-module feed being built for this pass. */
export interface AppNotificationDto {
  id: string;
  type: string; // info | success | warning | error | mention
  title: string;
  message: string;
  link: string | null;
  relatedToType: string | null;
  relatedToId: string | null;
  read: boolean;
  createdAt: string;
}

export interface MyNotificationsDto {
  items: AppNotificationDto[];
  unreadCount: number;
}
