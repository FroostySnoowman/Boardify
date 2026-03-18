# MyBreakPoint React Native App

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