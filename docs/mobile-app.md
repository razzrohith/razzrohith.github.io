# DealNest Mobile App Foundation

DealNest now supports Android and iOS from the same static HTML/CSS/JavaScript codebase using Capacitor.

## Architecture Decision

Chosen approach: Capacitor wrapper around the existing web app.

Why this fits this project:

- The current DealNest website is already a working static app with Supabase reads, auth, post deal, image upload, alerts, click tracking, admin moderation, community, dark mode, and premium responsive UI.
- Capacitor packages the same app into native Android and iOS projects without rewriting the product in React Native or Flutter.
- The web app remains the source of truth. GitHub Pages deployment remains unchanged.
- Native APIs can be added gradually for status bar, splash screen, haptics, browser OAuth, push notifications, camera/gallery, and app links.

Alternatives reviewed:

- Expo React Native WebView shell: also possible, but it adds another app framework while still wrapping the web app.
- Full React Native rewrite: strongest native UX long-term, but too expensive and risky for the current verified MVP.
- Flutter rewrite: same concern as React Native, plus a separate UI implementation to maintain.

Limitations:

- The first mobile app is still mostly the web UI inside a native WebView.
- Google OAuth on mobile requires custom redirect/deep-link settings.
- iOS builds require macOS, Xcode, and an Apple Developer account.
- Push notifications are not implemented yet.
- Store release signing, privacy labels, screenshots, and review metadata are future work.

Rollback plan:

- The web app is unchanged as the source product.
- Remove `android/`, `ios/`, `capacitor.config.json`, `package.json`, `package-lock.json`, `resources/`, and the mobile helper scripts to return to a web-only repo.
- The checkpoint tag `pre-mobile-capacitor-v1` points to the verified state before Capacitor.

## Files And Folders Added

- `capacitor.config.json`: Capacitor app configuration.
- `android/`: Android native project.
- `ios/`: iOS native project.
- `resources/`: original DealNest icon and splash source assets.
- `assets/js/deals-mobile.js`: native shell integration for safe areas, status bar, app back button, haptics, and OAuth deep-link handling.
- `scripts/prepare-capacitor-web.mjs`: copies the static app into `www/` for Capacitor.
- `scripts/write-runtime-config.mjs`: writes public Supabase runtime config from environment variables when preparing local/mobile builds.
- `package.json` / `package-lock.json`: Capacitor dependencies and scripts.

`www/` is generated and ignored by Git.

## Runtime Config

Web production:

- GitHub Actions generates `assets/js/runtime-config.js` using repository secrets.
- Only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are exposed.
- No service role key is used.

Local web:

- The existing frontend can read local `.env` on `localhost`.
- `.env` is ignored by Git.

Mobile:

- Before syncing a release/dev mobile build, generate the public runtime config locally:

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" SUPABASE_ANON_KEY="YOUR_ANON_KEY" npm run config:runtime
npm run mobile:sync
```

PowerShell example:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_ANON_KEY="YOUR_ANON_KEY"
npm.cmd run config:runtime
npm.cmd run mobile:sync
```

Important:

- `SUPABASE_ANON_KEY` is the public publishable key protected by RLS.
- Never use `SUPABASE_SERVICE_ROLE_KEY` in the mobile app.
- Do not commit generated real `assets/js/runtime-config.js` values.

## Android

Project:

- Folder: `android/`
- App name: `DealNest`
- App ID: `com.razzrohith.dealnest`
- Custom OAuth scheme: `com.razzrohith.dealnest://auth/callback`

Commands:

```bash
npm install
npm run mobile:sync
npx cap open android
```

Build debug APK:

```bash
cd android
./gradlew assembleDebug
```

Build release AAB:

```bash
cd android
./gradlew bundleRelease
```

Windows note:

- `android/gradlew.bat assembleDebug` requires Java/JDK and `JAVA_HOME`.
- In this workspace the Android debug build could not complete because `JAVA_HOME` is not set.
- Install Android Studio/JDK, set `JAVA_HOME`, then rerun the Gradle command.

Google OAuth Android setup:

- Add Android OAuth client in Google Cloud.
- Package name: `com.razzrohith.dealnest`
- Add SHA-1/SHA-256 fingerprints from your debug/release keystores.
- Keep Google client secret only in Supabase provider settings, not in frontend code.

Supabase redirect URLs to add:

```text
com.razzrohith.dealnest://auth/callback
https://razzrohith.com/**
http://localhost:*
```

## iOS

Project:

- Folder: `ios/`
- Bundle ID: `com.razzrohith.dealnest`
- Custom OAuth scheme: `com.razzrohith.dealnest://auth/callback`

Commands:

```bash
npm install
npm run mobile:sync
npx cap open ios
```

iOS requirements:

- macOS
- Xcode
- Apple Developer account for device testing and App Store/TestFlight release

Google OAuth iOS setup:

- Add iOS OAuth client in Google Cloud.
- Bundle ID: `com.razzrohith.dealnest`
- Keep Google Client ID/Secret inside Supabase provider settings.
- Add the custom redirect URL to Supabase Auth redirect URLs.

Windows note:

- The iOS project was generated and synced, but it cannot be built or opened in Xcode on Windows.

## Mobile Auth And OAuth

Email/password auth:

- Uses the existing Supabase Auth REST flow.
- Guest browsing remains open.

Google OAuth:

- Web flow remains unchanged for browsers.
- Native flow uses the Capacitor Browser plugin where available.
- OAuth returns to `com.razzrohith.dealnest://auth/callback`.
- `assets/js/deals-mobile.js` listens for the app URL open event and hands the URL back to `deals-auth.js`.

Manual settings required before full native Google OAuth QA:

- Add `com.razzrohith.dealnest://auth/callback` in Supabase Auth redirect URLs.
- Configure Android and iOS OAuth clients in Google Cloud as described above.

## Native UX Foundation

Implemented:

- Safe-area padding for notches/home indicators.
- Native status bar color updates for light/dark mode.
- Splash screen hide on app load.
- Android hardware back button handling.
- Light haptic tap feedback on buttons/actions.
- Original app icon and splash artwork.
- Existing responsive UI, dark mode, auth modal, forms, admin, dashboard, and community pages are reused.

Future native improvements:

- Camera/gallery picker for post-deal image uploads.
- Native pull-to-refresh.
- Push notification registration for deal alerts.
- Native share sheet for deal detail pages.
- App store deep links and universal/app links.

## QA Checklist

Guest:

- Homepage loads and shows public deals.
- Search/filter/sort work.
- Deal detail opens.
- Categories, stores, coupons, community, saved, alerts, and games load.
- Alerts/posting/protected community actions prompt login.
- Get Deal redirect works safely.
- Dark mode works.

Logged-in:

- Email/password login and logout.
- Google OAuth after mobile redirect settings are configured.
- Save, vote, comment, report, post deal, image upload, alerts, dashboard.

Admin:

- Admin page access for admin/mod roles.
- Deal moderation queue.
- Community moderation queue.
- Approve/reject/hide/expire UI.

Technical:

- No service role key exposed.
- `.env` remains ignored.
- Supabase RLS remains the security boundary.
- No horizontal overflow.
- Keyboard does not break forms.
- External links open safely.
