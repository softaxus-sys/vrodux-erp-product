import { Linking, Platform } from "react-native";
import * as StoreReview from "expo-store-review";

/** The app's Play Store listing -- also where "Rate" falls back to when the in-app dialog isn't available. */
export const ANDROID_PACKAGE = "com.softaxis.vroduxerp";
export const SUPPORT_EMAIL = "vrodux@softaxis.ae";

/**
 * Asks for a rating with the platform's own in-app review dialog. The OS decides whether to show it
 * (it rate-limits itself), so a call can legitimately do nothing -- `true` means a request was made,
 * not that the dialog appeared.
 */
export async function requestInAppReview(): Promise<boolean> {
  try {
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

/** Opens the store page's review section -- the reliable path behind a "Rate this app" button, since the
 *  in-app dialog may be suppressed by the OS. */
export async function openStoreReview(): Promise<void> {
  const url =
    Platform.OS === "android"
      ? `market://details?id=${ANDROID_PACKAGE}`
      : (StoreReview.storeUrl() ?? "");
  try {
    // No canOpenURL check: on Android 11+ it needs a manifest <queries> entry to answer true for
    // market://, and openURL itself throws when nothing can handle the link.
    if (url) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // fall through to the web listing
  }
  await Linking.openURL(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`);
}

export function openFeedbackEmail(appVersion: string, userEmail?: string | null): Promise<void> {
  const subject = encodeURIComponent(`Vrodux ERP app feedback (v${appVersion})`);
  const body = encodeURIComponent(`\n\n—\nApp version: ${appVersion}\nPlatform: ${Platform.OS} ${Platform.Version}${userEmail ? `\nAccount: ${userEmail}` : ""}`);
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
}
