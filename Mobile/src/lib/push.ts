/**
 * Mobile push notifications, via Expo's push service (which relays to APNs/FCM on our behalf --
 * no native certificates or server keys on either side). This is the client half of the feature;
 * the server half is Identity's `/api/account/device-tokens` + the shared `IPushNotificationSender`
 * (see Backend CLAUDE.md's Push Notifications module for the full design and what is/isn't wired
 * up server-side yet).
 *
 * IMPORTANT LIMITATION: there is no EAS project configured yet (that's the next queued item after
 * this one -- see Mobile/README.md). `getExpoPushTokenAsync` can still resolve a token while running
 * in Expo Go (it infers the project from the logged-in Expo dev session), but Android's Expo Go no
 * longer supports *receiving* a remote push at all as of SDK 53+, and neither platform's standalone
 * build behavior can be verified until a real EAS/dev-client build exists. Registration, the token
 * round-trip to the backend, and local/foreground notification handling can all be exercised today;
 * a real "phone buzzes while the app is closed" test cannot be, yet.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { deviceTokensApi } from "@/lib/device-tokens.api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Cached so logout can unregister the same token without asking the OS for it again. */
let lastKnownToken: string | null = null;

/** Requests permission (if not already granted) and registers this device's Expo push token with
 *  the backend. Called once per authenticated session start -- see RootNavigator's AuthenticatedApp
 *  effect. Never throws: push is a nice-to-have, not a login blocker. */
export async function registerForPushAsync(): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulators/emulators can't receive real push

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    lastKnownToken = tokenResponse.data;

    await deviceTokensApi.register({
      expoPushToken: lastKnownToken,
      platform: Platform.OS === "ios" ? "ios" : "android",
      deviceName: Device.deviceName ?? undefined,
    });
  } catch {
    // No EAS project / no network / permission dialog dismissed -- the app works either way.
  }
}

/** Best-effort: stop sending push to this device. Called before clearing the session on sign-out. */
export async function unregisterPushAsync(): Promise<void> {
  try {
    if (!lastKnownToken) return;
    await deviceTokensApi.unregister(lastKnownToken);
  } catch {
    // Server-side cleanup failing must never block the local sign-out the user asked for.
  } finally {
    lastKnownToken = null;
  }
}
