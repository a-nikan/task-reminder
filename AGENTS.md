# Nick Task Reminder — Agent Notes

## Versioning (user standing instruction)
The assistant bumps the app version itself whenever a new build/release with changes is delivered.

- Patch (2.0.0 → 2.0.1): bug fixes, icon/UI tweaks. Minor (→ 2.1.0): new features. Major: breaking changes.
- Update ALL of these together:
  1. `package.json` → `"version"` (drives installer name + desktop `getVersion()`)
  2. `package-lock.json` → `"version"` at top level AND inside `packages.""` (lines ~3 and ~9)
  3. `android/app/build.gradle` → `versionCode` (increment by 1 every release) + `versionName`
- UI reads version dynamically via `window.electronAPI.getVersion()` (About tab + Sidebar footer) — no hardcoded version in UI.
- After bumping, rebuild both artifacts: Android APK + Windows installer.

## Build commands (PowerShell — no `&&`; bash tool needs explicit long timeouts)
- Typecheck: `npx tsc --noEmit`
- Web + Electron: `npx vite build` (outputs `dist/`, `dist-electron/`) then `npx cap sync android`
- Android APK: in `android/` dir with `$env:JAVA_HOME="C:\tools\jdk-21.0.12.1+1"; $env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"; .\gradlew.bat assembleDebug --console=plain` (timeout ≥ 600000 ms) → copy `app\build\outputs\apk\debug\app-debug.apk` to `release\Nick Task Reminder Android <ver>.apk`
- Windows installer: `$env:CSC_IDENTITY_AUTO_DISCOVERY="false"; $env:CSC_LINK=""; npx electron-builder --win --x64` (timeout ≥ 900000 ms) → `release\Nick Task Reminder Setup <ver>.exe`

## Conventions
- App is Persian/RTL; platform-agnostic logic lives in `shared/`, desktop thin layers in `electron/`, Android bridge in `src/platform/androidApi.ts`.
- No runtime CDN/network dependencies in UI code (fonts are local in `public/fonts/`) — app must boot fully offline.
- Never write source files with PowerShell `Get-Content -Raw | Set-Content` — it corrupts Persian text (UTF-8 vs ANSI). Use the Edit tool.
- Sync (LAN, Google Drive rejected by user): desktop runs an HTTP server on port 8787 (`electron/lanServer.ts`, started in `main.ts`, token persisted in `userData/lan.json`, endpoints `GET|POST /sync` with `Authorization: Bearer` or `?t=`, CORS `*`); phone/desktop renderer client in `src/platform/lanSync.ts` (localStorage keys `tr-lan-addr`/`tr-lan-token`/`tr-lan-lastsync`; auto-sync: 15s debounce after store changes, on visibility/online, 120s interval; syncNow pre-checks `/health` first). Merge core in `shared/sync.ts` (`mergeSnapshots`/`applySnapshot`); apply+reminder-ensure in `electron/syncApply.ts`; platform hooks `sync:snapshot`/`sync:apply` (desktop IPC) and `getSyncSnapshot`/`applySyncSnapshot` (androidApi); `lan:info`/`lan:regenToken` IPC. **`capacitor.config.ts` MUST keep `server.androidScheme: 'http'`** — default `'https'` origin makes WebView block fetch() to the plain-HTTP LAN server as mixed content (app shows "unreachable" while browser works). Android needs `android:usesCleartextTraffic="true"` (LAN is plain HTTP). Settings card: desktop shows addresses+token, phone has address/token inputs (Settings ← data tab).
