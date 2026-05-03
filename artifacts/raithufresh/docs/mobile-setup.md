# RaithuFresh — Mobile App Setup Guide

Capacitor Android (and later iOS) packaging for RaithuFresh.

---

## 1. Current Status

| Layer | Status |
|---|---|
| Web/PWA MVP | Release Candidate READY |
| Capacitor scaffold | Done — config + packages installed |
| Android platform | Requires local Android Studio setup |
| iOS platform | Requires macOS + Xcode — planned for later |

The web app remains the source of truth. The Capacitor wrapper packages the
existing web build into a native Android/iOS shell with no code duplication.

---

## 2. How Capacitor Works Here

```
artifacts/raithufresh/
├── src/                      React/Vite web source
├── public/                   PWA assets, icons, manifest
├── dist/public/              Vite build output  ← Capacitor reads this
├── capacitor.config.ts       Capacitor config
├── android/                  Android project (create locally)
└── ios/                      iOS project (macOS only, not yet)
```

Capacitor copies `dist/public/` into the Android project and wraps it in a
WebView. Your existing Supabase calls, routing, and PWA assets all work as-is.

---

## 3. Capacitor Config

File: `artifacts/raithufresh/capacitor.config.ts`

```ts
appId:   "com.raithufresh.app"
appName: "RaithuFresh"
webDir:  "dist/public"          // Must match Vite build output directory
server.androidScheme: "https"   // Required for secure cookie / SameSite behaviour
```

> Before publishing to Google Play Store, confirm the `appId` with your Play
> Console account. Once published, the appId cannot be changed.

---

## 4. Required Tools (Local Machine)

Install these on your local development machine (Windows/Linux/Mac):

| Tool | Version | Download |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| Android Studio | Latest | https://developer.android.com/studio |
| JDK | 17+ (bundled with Android Studio) | Via Android Studio |
| Android SDK | API 35+ | Via Android Studio SDK Manager |

> Android Studio includes a bundled JDK. Use that to avoid JDK version conflicts.

---

## 5. Android Local Setup (Step by Step)

All commands must be run from inside the artifact directory:

```bash
cd artifacts/raithufresh
```

### Step 1 — Install dependencies

```bash
pnpm install
```

### Step 2 — Build the web app for Capacitor

This sets `BASE_PATH=/` (required for mobile — the Replit proxy path is not
used on device) and a dummy `PORT` (only needed for dev server, not build):

```bash
pnpm run build:cap
```

Output: `dist/public/` — Capacitor will copy this into the Android project.

### Step 3 — Add the Android platform

Run this once. It creates the `android/` directory:

```bash
npx cap add android
```

### Step 4 — Sync web assets into Android

Run this after every `build:cap`:

```bash
pnpm run cap:sync
# or: npx cap sync android
```

### Step 5 — Open in Android Studio

```bash
pnpm run cap:open
# or: npx cap open android
```

Android Studio will open the `android/` project. Let Gradle sync finish.

### Step 6 — Run on emulator or device

In Android Studio:
- Select a device or emulator from the toolbar
- Click Run (green play button)
- Or: Shift+F10

### Step 7 — Build a debug APK

In Android Studio:
- Build > Build Bundle(s) / APK(s) > Build APK(s)
- APK will be in: `android/app/build/outputs/apk/debug/app-debug.apk`

Or via terminal (requires Gradle in PATH):
```bash
cd android
./gradlew assembleDebug
```

---

## 6. Environment Variables

The mobile build uses the same Supabase environment variables baked in at build
time by Vite. They are injected at `pnpm run build:cap` time.

| Variable | Source | Used In |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` or Replit Secrets | `src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | `.env` or Replit Secrets | `src/lib/supabase.ts` |

**Never add to mobile build:**

| Variable | Reason |
|---|---|
| `SUPABASE_DB_URL` | Direct DB connection — never in frontend/mobile |
| `service_role` key | Admin key — never in frontend/mobile |
| Any signing credentials | Keep in CI secrets or local keystore only |

For local builds, create `artifacts/raithufresh/.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

This file is in `.gitignore`. Never commit it.

---

## 7. Routing Note

RaithuFresh uses `wouter` with browser history routing. Capacitor v5+ serves
the app via its own local HTTPS server (`capacitor://localhost` on Android),
which supports path-based routing correctly.

No changes to the React router are needed.

---

## 8. App Icons

Existing PWA icons are present in `public/` and will be copied to `dist/public/`
by Vite. For the Play Store you will also need:

| Asset | Size | Status |
|---|---|---|
| App icon | 192×192 PNG | Done (`icon-192.png`) |
| App icon | 512×512 PNG | Done (`icon-512.png`) |
| Maskable icon | 192×192 PNG | Done (`icon-maskable-192.png`) |
| Maskable icon | 512×512 PNG | Done (`icon-maskable-512.png`) |
| Play Store feature graphic | 1024×500 PNG | Not yet created |
| Play Store screenshots | 2–8 phone screenshots | Not yet created |

For Android Studio adaptive icons, Capacitor will generate placeholders
from the Capacitor default. Replace them via:
- Android Studio > Resource Manager > + > Image Asset

---

## 9. After Every Web Code Change

```bash
pnpm run build:cap        # Rebuild web assets
pnpm run cap:sync         # Copy into android/ project
# Then re-run from Android Studio or rebuild APK
```

---

## 10. What Not to Commit

The `.gitignore` already excludes these:

```
android/          Android Studio project (large, generated)
ios/              Xcode project (large, generated)
dist/             Vite build output (generated)
.env              Supabase credentials
.env.*            All env files
*.jks             Android signing keystore
*.keystore        Signing keystore
google-services.json    Firebase config (not used — keep excluded anyway)
```

Do not commit signing keystores. Store them in a password manager or CI secret.

---

## 11. iOS — Planned for Later

iOS packaging requires:
- macOS machine
- Xcode (free from Mac App Store)
- Apple Developer account ($99/year for App Store publishing)

When ready, from `artifacts/raithufresh/` on a Mac:

```bash
pnpm run build:cap
npx cap add ios
npx cap sync ios
npx cap open ios        # Opens Xcode
```

In Xcode:
- Set Bundle Identifier to `com.raithufresh.app`
- Select your Apple Developer Team
- Product > Archive to build for App Store

---

## 12. Known Limitations

| Limitation | Notes |
|---|---|
| Android build requires local Android Studio | Cannot run in Replit (no JDK/SDK) |
| iOS requires macOS + Xcode | Not available on Linux/Windows |
| Service worker | Runs in PWA mode on web; in Capacitor mode, native caching handles offline |
| Push notifications | Not planned — not added |
| Deep links | Not configured yet — URL routing works in-app |
| Splash screen | Uses Capacitor default — customise with @capacitor/splash-screen (free) |
| Camera/Location | Not used — no native plugins added yet |
| Play Store release signing | Requires a signing keystore — create locally, never commit |

---

## 13. Capacitor Doctor

Run this to verify your local environment is ready:

```bash
cd artifacts/raithufresh
npx cap doctor
```

Expected output shows Android SDK, Java, and Gradle paths.

---

## 14. Useful References

- Capacitor docs: https://capacitorjs.com/docs
- Android Studio: https://developer.android.com/studio
- Google Play Console: https://play.google.com/console (free to register, $25 one-time fee)
- Apple App Store Connect: https://appstoreconnect.apple.com ($99/year)
