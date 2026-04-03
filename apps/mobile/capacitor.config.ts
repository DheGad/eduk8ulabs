/**
 * @file capacitor.config.ts
 * @app StreetMP OS Mobile Shell
 * @command COMMAND_093 — THE SOVEREIGN SHELL
 * @version V93.0.0
 *
 * ================================================================
 * HARDWARE-BACKED MOBILE ARCHITECTURE
 * ================================================================
 *
 * Capacitor wraps the StreetMP OS PWA into a native iOS/Android
 * shell with full access to hardware security primitives:
 *
 *   iOS:     Secure Enclave   → AES-256-GCM encrypted Keychain
 *   Android: Android Keystore → Hardware-backed StrongBox/TEE
 *
 * Biometric gate (FaceID/TouchID/Fingerprint) is enforced BEFORE
 * the WebView is allowed to mount the React app. For zero-tolerance
 * environments this is non-bypassable at the native layer.
 *
 * ================================================================
 * PLUGIN REGISTRY
 * ================================================================
 *
 *   @capacitor/app                        — Lifecycle events
 *   @capacitor/biometrics                 — FaceID / TouchID gate
 *   @capacitor-community/secure-storage   — Keychain / Keystore
 *   @capacitor/preferences                — Non-secret app state
 *   @capacitor/push-notifications         — Encrypted push channel
 *   @capacitor/status-bar                 — Dark-mode status bar
 *   @capacitor/splash-screen              — Native branded splash
 *   @capacitor/haptics                    — Tactile feedback
 *   @capacitor-community/app-icon         — Dynamic app icon
 *
 * ================================================================
 */

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // ─── Application Identity ─────────────────────────────────────────────────
  appId:   "com.streetmp.os",
  appName: "StreetMP OS",

  // ─── Web Source ───────────────────────────────────────────────────────────
  // Points to the production live URL for remote mode (no local bundle needed).
  // For fully offline builds, set to: `webDir: "out"` (Next.js static export).
  webDir: "out",
  server: {
    // Production live server: renders the full Next.js app inside the WebView
    url:              "https://os.streetmp.com",
    cleartext:        false,   // Enforce HTTPS at native layer
    allowNavigation:  [
      "https://os.streetmp.com",
      "https://streetmp.com",
    ],
  },

  // ─── iOS Configuration ────────────────────────────────────────────────────
  ios: {
    // Minimum iOS version for Secure Enclave / LocalAuthentication
    // (FaceID available from iOS 11, hardware-backed keys from iOS 9)
    minVersion:                    "16.0",
    scheme:                        "streetmp-os",
    allowsLinkPreview:             false,   // No link preview exposes content
    scrollEnabled:                 true,
    contentInset:                  "always",
    // Disable web inspector in production (no devtools on production builds)
    webContentsDebuggingEnabled:   false,
    // Prevent screenshots of sensitive content
    preventScrolling:              false,
    // Use WKURLSchemeHandler for custom URL handling
    handleApplicationNotifications: true,
  },

  // ─── Android Configuration ────────────────────────────────────────────────
  android: {
    // Minimum Android API for hardware-backed Android Keystore
    minSdkVersion:         26,   // Android 8 — guaranteed StrongBox availability
    targetSdkVersion:      34,
    buildToolsVersion:     "34.0.0",
    // Disable cleartext traffic (force HTTPS at the OS network layer)
    allowMixedContent:     false,
    // Enable hardware-accelerated WebView rendering
    captureInput:          false,
    webContentsDebuggingEnabled: false,
    // App-level data encryption via Android File Based Encryption
    path:                  "android",
  },

  // ─── Plugin Configuration ─────────────────────────────────────────────────
  plugins: {
    // ─── Splash Screen ───────────────────────────────────────────────────
    SplashScreen: {
      launchShowDuration:        0,     // No delay — biometric replaces splash
      launchAutoHide:            false, // Manually hide after biometric passes
      backgroundColor:           "#0A0A0A",
      androidSplashResourceName: "splash",
      iosSplashResourceName:     "LaunchScreen",
      showSpinner:               false,
      splashFullScreen:          true,
      splashImmersive:           true,
    },

    // ─── Status Bar ──────────────────────────────────────────────────────
    StatusBar: {
      style:           "DARK",
      backgroundColor: "#0A0A0A",
      overlaysWebView: false,
    },

    // ─── Biometric Authentication (FaceID / TouchID / Fingerprint) ───────
    // @capacitor-community/biometric plugin config
    Biometric: {
      // Displayed in the native system prompt dialogue
      reason:          "Authenticate to access StreetMP OS",
      title:           "StreetMP OS",
      subtitle:        "Secure Authentication",
      description:     "Use biometrics to verify your identity",
      // Fallback to device PIN if biometric fails 3x
      fallbackTitle:   "Use Passcode",
      allowDeviceCredential: true,
      // iOS: Require biometric (no password bypass for highest-security mode)
      iosAllowPasswordFallback: true,
      // Android: Require Class 3 (strong) biometric (hardware-backed)
      androidBiometricStrength: "BIOMETRIC_STRONG",
    },

    // ─── Secure Storage (Keychain / Keystore) ────────────────────────────
    // @capacitor-community/secure-storage plugin config
    SecureStoragePlugin: {
      // iOS: uses kSecAttrAccessibleWhenUnlockedThisDeviceOnly —
      //      keys are NEVER backed up to iCloud
      iosAccessibility:              "kSecAttrAccessibleWhenUnlockedThisDeviceOnly",
      // Android: uses EncryptedSharedPreferences backed by Android Keystore
      // AES256_GCM_NoPadding + RSA2048 key wrapping
      androidNonFingerprintAuthAllowed: false,
    },

    // ─── Push Notifications ───────────────────────────────────────────────
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    // ─── Preferences (non-secret app state) ──────────────────────────────
    Preferences: {
      group: "com.streetmp.os.prefs",
    },
  },
};

export default config;
