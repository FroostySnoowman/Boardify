# React Native (Expo) Template

A production-ready React Native template built on **Expo 56**, **React 19**, and **TypeScript** — with full support for iOS, Android, and Web out of the box.

## Highlights

- **Expo Router** file-based navigation with native tabs (SF Symbols on iOS) and custom tab bars on Android/Web
- **NativeWind + Tailwind CSS** for styling with a dark-mode-first design system
- **Liquid Glass** support via `expo-glass-effect` for modern iOS UI
- **Authentication** baked in — email/password, Google Sign-In, and Apple Sign-In with secure token storage
- **Offline-aware** networking with `NetInfo`, cached auth state, and an offline banner
- **Reanimated 4** animations with keyboard-aware animated hooks
- **Platform-specific** top navigation (blur/glass on mobile, responsive nav on web)
- **Jest** testing with TypeScript and path aliases
- **Cloudflare Workers** web deployment ready (`public/_worker.js`)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Expo 56, React Native 0.84, React 19 |
| Language | TypeScript (strict mode) |
| Styling | NativeWind 4 + Tailwind CSS 3.4 |
| Navigation | Expo Router (file-based) |
| Auth | Google Sign-In, Apple Auth, email/password, Secure Store |
| Networking | Custom fetch client with Bearer tokens, offline detection |
| Animations | React Native Reanimated 4, Keyboard Controller |
| Storage | AsyncStorage (cache), Expo Secure Store (tokens) |
| Media | Expo Image, Camera, Video, Audio, Image Picker |
| UI | Vector Icons (Feather), LinearGradient, BlurView, Glass Effect |
| Testing | Jest 30, ts-jest |
| Web | React Native Web, Cloudflare Workers |

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS: Xcode 16+ / macOS
- Android: Android Studio with SDK 35+

### Install

```bash
cd app
npm install
```

### Environment Variables

Create `.env.development` in the `app/` directory:

```env
VITE_API_URL=http://localhost:8787
VITE_APP_URL=http://localhost:8081
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_ID_IOS=your-ios-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_ID_ANDROID=your-android-client-id
```

### Run

```bash
# Start dev server
npm start

# Run on platform
npm run ios
npm run android
npm run web
```

### Build

```bash
# iOS
npm run build:ios:dev        # Development prebuild
npm run build:ios:prod       # Production prebuild

# Android
npm run build:android        # Release APK
npm run build:android:debug  # Debug APK

# Web
npm run build:web            # Export for Cloudflare/static hosting
```

### Test

```bash
npm test                # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run typecheck       # TypeScript check
```

## Customization

- **Colors** — Edit `tailwind.config.js` (`background: '#020617'`, `foreground: '#f8fafc'`)
- **Tabs** — Add/remove tabs in `app/(tabs)/_layout.tsx` via the `TAB_ITEMS` array
- **Screens** — Add routes as files in `app/` — Expo Router handles the rest
- **API base URL** — Set `VITE_API_URL` in your `.env` file
- **App identity** — Update `app.config.js` (name, slug, bundle ID, icons)

## License

Private — not for redistribution.