# Boardify React Native App

## API base URL (native dev)

The app reads `VITE_API_BASE` from Expo `extra` (via `.env.development` / `.env.production` loaded in `app.config.js`). For **iOS Simulator** with the Worker on your Mac, `http://localhost:8787` is usually fine. For **Android Emulator**, use `http://10.0.2.2:8787`. For a **physical device**, use your machine’s LAN IP (for example `http://192.168.1.10:8787`) so the phone can reach the Worker.

### Push notifications (Expo)

With **Account → Notifications** enabled and a signed-in session, the app requests OS permission, reads the Expo push token (requires `extra.eas.projectId` in `app.config.js`), and registers it on the Worker at `POST /user/expo-push-token`. The Worker sends board-activity pushes via the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/) (respecting per-board **push enabled** in board notification settings; the actor is not notified). Tapping a notification opens that board (`router.replace` to `/board`). Use a dev build or EAS build for full push behavior; Expo Go can receive test pushes with the same project ID.

## Building for iOS & Android
```bash
# Generate native iOS/Android folders
npx expo prebuild --clean

# Build and run on iOS/Android
npx expo run:ios
npx expo run:android
```

### Build Android APK locally (faster, no EAS)
```bash
# Release APK (output: android/app/build/outputs/apk/release/app-release.apk)
npm run build:android

# Debug APK (faster, good for testing; output: android/app/build/outputs/apk/debug/app-debug.apk)
npm run build:android:debug
```

### Building Android Production AAB (for Google Play)
1. **Create a release keystore** (one-time):
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore keystore/my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Add `keystore.properties`** in the `app/` directory (gitignored). Example:
   ```properties
   storeFile=../../keystore/my-release-key.keystore
   storePassword=your-store-password
   keyAlias=my-key-alias
   keyPassword=your-key-password
   ```
   Paths are relative to the `android/` directory when Gradle runs, so `../../keystore/` points to `app/keystore/`.

3. **Prebuild and build AAB**:
   ```bash
   npx expo prebuild --clean
   cd android
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`