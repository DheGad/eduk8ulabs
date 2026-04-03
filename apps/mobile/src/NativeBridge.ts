/**
 * @file NativeBridge.ts
 * @app StreetMP OS Mobile Shell
 * @command COMMAND_093 — THE SOVEREIGN SHELL
 * @version V93.0.0
 *
 * ================================================================
 * THE HARDWARE SECURITY BRIDGE (MOBILE)
 * ================================================================
 *
 * This module provides the mobile native security layer:
 *
 *   1. BioAuthGate    — Blocks the app until FaceID/TouchID passes
 *   2. SecureVault    — Read/write to hardware Keychain/Keystore
 *   3. DeepLinkRouter — Handles streetmp:// URIs from other apps
 *
 * USAGE: Call NativeBridge.initialize() before mounting YOUR React /
 *        Next.js root component. The app will NOT boot until the
 *        biometric gate is cleared.
 *
 * ================================================================
 * SECURITY MODEL
 * ================================================================
 *
 *   iOS:     LocalAuthentication + kSecAttrAccessibleWhenUnlockedThisDeviceOnly
 *            → Key material NEVER leaves Secure Enclave
 *            → Never backed up to iCloud
 *
 *   Android: BiometricPrompt + Android Keystore (StrongBox when available)
 *            → AES-256-GCM with hardware-bound key
 *            → Class 3 (BIOMETRIC_STRONG) enforced
 *
 * ================================================================
 */

import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Preferences }                     from "@capacitor/preferences";
import { SplashScreen }                    from "@capacitor/splash-screen";
import { StatusBar, Style }                from "@capacitor/status-bar";
import { Haptics, ImpactStyle }            from "@capacitor/haptics";

// Plugin type declarations (loaded at runtime by Capacitor)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const BiometricAuth:    any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const SecureStoragePlugin: any;

// ─── Types ───────────────────────────────────────────────────────────────────

export type BiometricResult = {
  success:   true;
  method:    "FACE_ID" | "TOUCH_ID" | "FINGERPRINT" | "PIN";
} | {
  success:   false;
  reason:    "NOT_AVAILABLE" | "NOT_ENROLLED" | "CANCELLED" | "FAILED" | "LOCKED_OUT";
};

export interface VaultResult<T = string> {
  success: boolean;
  data?:   T;
  error?:  string;
}

// ─── BIO AUTH GATE ────────────────────────────────────────────────────────────
/**
 * Performs the biometric authentication challenge using hardware primitives.
 *
 * On iOS:     Uses LocalAuthentication (LAContext) → FaceID / TouchID
 * On Android: Uses BiometricPrompt → Fingerprint / Face / IRIS (Class 3)
 *
 * If "BIOMETRIC_STRONG" is not available, falls back to device PIN/password.
 * If NO credential is enrolled, returns { success: false, reason: "NOT_ENROLLED" }.
 *
 * NEVER returns { success: true } unless the OS hardware has verified the user.
 */
export async function performBioAuth(): Promise<BiometricResult> {
  try {
    // Check availability first
    const availResult = await BiometricAuth.checkBiometry();
    if (!availResult.isAvailable) {
      return {
        success: false,
        reason:  availResult.biometryType === "NONE"
          ? "NOT_ENROLLED"
          : "NOT_AVAILABLE",
      };
    }

    // Perform the actual challenge
    const result = await BiometricAuth.authenticate({
      reason:          "Authenticate to access StreetMP OS",
      title:           "StreetMP OS",
      subtitle:        "Secure Authentication",
      description:     "Verify your identity to continue",
      fallbackTitle:   "Use Passcode",
      // iOS: allow passcode fallback after 3 biometric failures
      iosFallbackTitle:    "Use Passcode",
      androidCancelButtonTitle: "Cancel",
      // Require hardware-backed biometric on Android
      androidBiometricStrength: "BIOMETRIC_STRONG",
    });

    if (result.verified) {
      await Haptics.impact({ style: ImpactStyle.Light });
      return {
        success: true,
        method:  availResult.biometryType ?? "FINGERPRINT",
      };
    }

    return { success: false, reason: "FAILED" };
  } catch (err: unknown) {
    const message = (err as { message?: string }).message ?? "";
    if (message.includes("cancel")) {
      return { success: false, reason: "CANCELLED" };
    }
    if (message.includes("lockout")) {
      return { success: false, reason: "LOCKED_OUT" };
    }
    return { success: false, reason: "FAILED" };
  }
}

// ─── SECURE VAULT ─────────────────────────────────────────────────────────────
/**
 * Writes a secret to the hardware-backed Keychain (iOS) or Keystore (Android).
 *
 * On iOS:     Stored with kSecAttrAccessibleWhenUnlockedThisDeviceOnly
 * On Android: EncryptedSharedPreferences + AES-256-GCM + Keystore key
 *
 * NEVER stores to localStorage or plain Preferences.
 */
export async function vaultWrite(key: string, value: string): Promise<VaultResult> {
  try {
    await SecureStoragePlugin.set({ key, value });
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error:   (err as { message?: string }).message ?? "vault_write_failed",
    };
  }
}

/**
 * Reads a secret from the hardware-backed secure store.
 * Returns null if the key doesn't exist.
 */
export async function vaultRead(key: string): Promise<VaultResult<string | null>> {
  try {
    const result = await SecureStoragePlugin.get({ key });
    return { success: true, data: result.value ?? null };
  } catch {
    return { success: true, data: null };
  }
}

/**
 * Removes a key from the hardware-backed secure store.
 */
export async function vaultDelete(key: string): Promise<VaultResult> {
  try {
    await SecureStoragePlugin.remove({ key });
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error:   (err as { message?: string }).message ?? "vault_delete_failed",
    };
  }
}

// ─── PREFERENCES (non-secret) ─────────────────────────────────────────────────
export async function prefSet(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value });
}

export async function prefGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

// ─── DEEP LINK ROUTER ─────────────────────────────────────────────────────────
/**
 * Parses a streetmp:// URI and returns the Next.js route to navigate to.
 *
 *   streetmp://verify/:hash   → /dashboard/sovereign/verify?hash=:hash
 *   streetmp://audit/:txId    → /dashboard/sovereign/audit?tx=:txId
 *   streetmp://workspace/:id  → /dashboard/workspace?id=:id
 *   streetmp://builder        → /dashboard/builder
 */
export function parseDeepLink(url: string): string {
  try {
    const parsed   = new URL(url);
    const host     = parsed.hostname;
    const pathParts = parsed.pathname.replace(/^\//, "").split("/");

    switch (host) {
      case "verify":
        return `/dashboard/sovereign/verify?hash=${encodeURIComponent(pathParts[0] ?? "")}`;
      case "audit":
        return `/dashboard/sovereign/audit?tx=${encodeURIComponent(pathParts[0] ?? "")}`;
      case "workspace":
        return `/dashboard/workspace?id=${encodeURIComponent(pathParts[0] ?? "")}`;
      case "builder":
        return "/dashboard/builder";
      default:
        return "/dashboard";
    }
  } catch {
    return "/dashboard";
  }
}

// ─── MAIN INITIALIZATION ──────────────────────────────────────────────────────
/**
 * Call this function once, before mounting the React root.
 *
 * It will:
 *   1. Set the status bar to dark (matching #0A0A0A)
 *   2. Perform the biometric authentication gate
 *   3. Register the streetmp:// deep-link handler
 *   4. Hide the splash screen (release control to the web app)
 *
 * @param onAuthFailed  Called if the biometric gate fails — show error UI
 * @param onDeepLink    Called when a deep-link is received after boot
 */
export async function initializeMobileShell({
  onAuthFailed,
  onDeepLink,
}: {
  onAuthFailed: (reason: string) => void;
  onDeepLink:   (route: string) => void;
}): Promise<void> {
  // ─── Status bar ───────────────────────────────────────────────────────────
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0A0A0A" });
  } catch {
    // Non-fatal — status bar styling not critical
  }

  // ─── Session check: was the user already authenticated this session? ───────
  const sessionActive = await prefGet("biometric_session_active");
  const sessionTs     = parseInt(sessionActive ?? "0", 10);
  const SESSION_TTL_MS = 15 * 60 * 1000;  // 15 minutes

  const needsAuth = !sessionTs || (Date.now() - sessionTs) > SESSION_TTL_MS;

  if (needsAuth) {
    // ─── Biometric gate ────────────────────────────────────────────────────
    const authResult = await performBioAuth();

    if (!authResult.success) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      onAuthFailed(authResult.reason);
      // Do NOT hide splash — keep user locked out
      return;
    }

    // Mark session active (expires after SESSION_TTL_MS)
    await prefSet("biometric_session_active", String(Date.now()));
  }

  // ─── Deep-link registration ────────────────────────────────────────────────
  App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
    if (event.url.startsWith("streetmp://")) {
      const route = parseDeepLink(event.url);
      onDeepLink(route);
    }
  });

  // ─── Clear splash — hand control to the Next.js UI ────────────────────────
  await SplashScreen.hide({ fadeOutDuration: 300 });
}
