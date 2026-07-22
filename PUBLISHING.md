# Publishing Overload

A staged guide from "on my own phone" to "in the app stores." Do the stages in
order — each one builds on the last. You're on **Windows** with **access to a Mac**
(needed only for the iOS store build).

> **Current status:** Stage A is DONE. The app is live at
> **https://overloadylan.netlify.app/** via GitHub-connected Netlify auto-deploy —
> every `git push` to `main` redeploys automatically. Install it on the phone with
> "Add to Home Screen." Next milestone: Stage B (Capacitor) when you're ready for stores.

---

## Stage A — Install it on your own phone (no Mac, no accounts, free)

Overload is a **PWA** (installable web app). Two ways to get it on your phone.

### A1. Quick preview over Wi-Fi (instant, temporary)
Phone and PC must be on the **same Wi-Fi**.

```bash
npm run build
npm run preview -- --host
```

Vite prints a `Network:` URL like `http://192.168.1.23:4173/`. Open that on your
phone's browser.
- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home Screen**.

The icon appears on your home screen and opens fullscreen. This preview only works
while `npm run preview` is running and you're on the same network.

### A2. Permanent install via a free host (recommended)
Deploy the site once so you can install it anywhere and it keeps working.

1. Create a free account at **Netlify** (netlify.com) or **Vercel** (vercel.com).
2. "Add new site" → **Import from Git** → pick the private `Overload` repo.
3. Build settings (Netlify usually auto-detects):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy. You get a URL like `https://overload-xyz.netlify.app`.
5. Open that URL on your phone → **Add to Home Screen** (as above).

Now it's installed permanently, works offline, and updates whenever you re-deploy.

> Your workout data lives **on the device** (localStorage). Installing on a new
> phone starts empty — use **Settings → Export backup** on the old device and
> **Import backup** on the new one to move your history.

---

## Stage B — Wrap it as a native app with Capacitor (when you want store builds)

Capacitor packages this exact web app into real iOS/Android projects. We chose it
over Expo/React Native because the whole UI is web code — no rewrite needed.

### One-time setup
```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init Overload com.YOURNAME.overload --web-dir dist
npm install @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap add ios        # do this step on the Mac
```

Pick a real **bundle id** for `com.YOURNAME.overload` (reverse-domain, lowercase,
no spaces) — it's permanent once published.

Every time you change the app:
```bash
npm run build
npx cap sync
```

### Android (fully on Windows)
1. Install **Android Studio**.
2. `npx cap open android` → let Gradle sync.
3. Plug in your Android phone (USB debugging on) → press **Run** to install it, OR
   Build → **Build APK** and copy the APK to your phone to sideload. No Google
   account needed for personal testing.

### Follow-up: real rest-timer alert (sound at zero)
The web rest timer only flashes **"Done"** — sound and vibration were removed because
a backgrounded iOS PWA can't reliably fire Web Audio or `navigator.vibrate` (they were
silent on iPhone). Once wrapped with Capacitor, add a **native local notification** that
fires at zero and plays a sound even when the phone is locked or you're in another app:

```bash
npm install @capacitor/local-notifications
```

Schedule a one-shot notification for the timer's end time (`Date.now() + seconds*1000`)
when the user starts the countdown, and cancel it if they Skip/Reset. This is the proper
fix for the alert that couldn't work as a PWA — wire it into `RestTimer` in `src/App.jsx`.

### iOS (needs the Mac)
1. Copy the project to the Mac (or clone the repo there and run the setup above,
   including `npx cap add ios`).
2. Install **Xcode**. `npx cap open ios`.
3. Sign in with your Apple ID under Signing & Capabilities (a **free** Apple ID
   works for installing on your *own* device — the app lasts ~7 days before you
   re-run it; the $99/yr program removes that limit).
4. Select your iPhone → **Run**.

---

## Stage C — Submit to the stores

### Accounts (required, paid)
- **Google Play:** Play Console — **$25 one-time**.
- **Apple App Store:** Apple Developer Program — **$99/year**.

### Assets you'll need for both
- **App icon** 1024×1024 PNG (we have `public/icon.svg` as the master — export at 1024).
- **Screenshots** at the sizes each store lists (a few per device class).
- **Short + full description**, category (Health & Fitness).
- **Privacy policy URL.** Simple here: *"Overload stores all workout data locally on
  your device. It has no accounts, no servers, and collects/transmits no personal
  data."* Host that text anywhere public (e.g. a GitHub Pages page).
- **Content rating** questionnaire (this app rates as "Everyone").

### Google Play (Android)
1. In Play Console, create the app, fill the store listing + data-safety form
   (declare "no data collected").
2. Produce a signed **App Bundle (.aab)**: in Android Studio, Build → Generate Signed
   Bundle, create an upload keystore (**back it up — losing it blocks future updates**).
3. Upload to the **Internal testing** track first, test on your phone, then promote to
   Production. Review is usually hours-to-days.

### Apple App Store (iOS, on the Mac)
1. In App Store Connect, register the bundle id and create the app record.
2. In Xcode: Product → **Archive** → Distribute → **App Store Connect**.
3. Add it to **TestFlight** to test on your device, complete the listing +
   privacy questions ("no data collected"), then submit for review.

---

## Data-privacy posture (keeps store forms easy)

Overload is entirely on-device: no backend, no analytics, no third-party network
calls (fonts are bundled, not fetched). On every store questionnaire you can honestly
answer **"no data collected / no tracking,"** which is the simplest path through review.
