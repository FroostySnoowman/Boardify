const fs = require('fs');
const path = require('path');

const isRelease = process.env.EXPO_PUBLIC_BUILD_ENV === 'production' || process.env.NODE_ENV === 'production';
const appVersion = '0.0.2';
const buildNumber = process.env.BUILD_NUMBER || '199';

function loadEnvFile(filename) {
  const envPath = path.join(__dirname, filename);
  const envVars = {};
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envVars[key.trim()] = value.trim();
        }
      }
    });
  }
  
  return envVars;
}

const envDev = loadEnvFile('.env.development');
const envProd = loadEnvFile('.env.production');
const envBase = loadEnvFile('.env');

let envVars = {};
if (isRelease) {
  envVars = Object.keys(envProd).length > 0 ? envProd : envDev;
  if (Object.keys(envVars).length === 0) {
    envVars = envBase;
  }
} else {
  envVars = Object.keys(envDev).length > 0 ? envDev : envProd;
  if (Object.keys(envVars).length === 0) {
    envVars = envBase;
  }
}

const envKeysFromProcess = [
  'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID_DEV',
  'GOOGLE_OAUTH_CLIENT_ID_IOS', 'GOOGLE_OAUTH_CLIENT_ID_IOS_DEV',
  'GOOGLE_OAUTH_CLIENT_ID_ANDROID', 'GOOGLE_OAUTH_CLIENT_ID_ANDROID_DEV',
  'EXPO_PUBLIC_APNS_ENVIRONMENT',
  'EXPO_PUBLIC_INCLUDE_SANDBOX_SUBSCRIPTIONS',
];
envKeysFromProcess.forEach((key) => {
  if (process.env[key]) {
    envVars[key] = process.env[key];
  }
});

const extra = {};
Object.keys(envVars).forEach(key => {
  if (key.startsWith('VITE_')) {
    extra[key] = envVars[key];
  }
});

if (envVars.GOOGLE_OAUTH_CLIENT_ID) {
  extra.GOOGLE_OAUTH_CLIENT_ID = envVars.GOOGLE_OAUTH_CLIENT_ID;
}
if (envVars.GOOGLE_OAUTH_CLIENT_ID_DEV) {
  extra.GOOGLE_OAUTH_CLIENT_ID_DEV = envVars.GOOGLE_OAUTH_CLIENT_ID_DEV;
}
if (envVars.GOOGLE_OAUTH_CLIENT_ID_IOS) {
  extra.GOOGLE_OAUTH_CLIENT_ID_IOS = envVars.GOOGLE_OAUTH_CLIENT_ID_IOS;
}
if (envVars.GOOGLE_OAUTH_CLIENT_ID_IOS_DEV) {
  extra.GOOGLE_OAUTH_CLIENT_ID_IOS_DEV = envVars.GOOGLE_OAUTH_CLIENT_ID_IOS_DEV;
}
if (envVars.GOOGLE_OAUTH_CLIENT_ID_ANDROID) {
  extra.GOOGLE_OAUTH_CLIENT_ID_ANDROID = envVars.GOOGLE_OAUTH_CLIENT_ID_ANDROID;
}
if (envVars.GOOGLE_OAUTH_CLIENT_ID_ANDROID_DEV) {
  extra.GOOGLE_OAUTH_CLIENT_ID_ANDROID_DEV = envVars.GOOGLE_OAUTH_CLIENT_ID_ANDROID_DEV;
}
const isEasProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
extra.EXPO_PUBLIC_APNS_ENVIRONMENT = envVars.EXPO_PUBLIC_APNS_ENVIRONMENT || (isEasProductionBuild ? 'production' : 'sandbox');
if (envVars.STRIPE_PUBLISHABLE_KEY) {
  extra.STRIPE_PUBLISHABLE_KEY = envVars.STRIPE_PUBLISHABLE_KEY;
}
const includeSandboxSubscriptionsRaw =
  envVars.EXPO_PUBLIC_INCLUDE_SANDBOX_SUBSCRIPTIONS ||
  process.env.EXPO_PUBLIC_INCLUDE_SANDBOX_SUBSCRIPTIONS ||
  'false';
extra.EXPO_PUBLIC_INCLUDE_SANDBOX_SUBSCRIPTIONS =
  String(includeSandboxSubscriptionsRaw).toLowerCase() === 'true' ? 'true' : 'false';

function getReversedClientId() {
  let iosClientId = isRelease 
    ? envVars.GOOGLE_OAUTH_CLIENT_ID_IOS 
    : (envVars.GOOGLE_OAUTH_CLIENT_ID_IOS_DEV || envVars.GOOGLE_OAUTH_CLIENT_ID_IOS);
  
  if (!iosClientId) {
    if (process.env.EAS_BUILD_PLATFORM === 'android') {
      return 'com.googleusercontent.apps.placeholder';
    }
    throw new Error(
      `iOS Client ID not found in environment. ` +
      `Please add GOOGLE_OAUTH_CLIENT_ID_IOS${isRelease ? '' : ' or GOOGLE_OAUTH_CLIENT_ID_IOS_DEV'} to your .env${isRelease ? '.production' : '.development'} file or in EAS Environment Variables.`
    );
  }
  
  iosClientId = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return `com.googleusercontent.apps.${iosClientId}`;
}

function getAllReversedClientIds() {
  const schemes = ['mybreakpoint'];
  
  const prodIosClientId = envProd.GOOGLE_OAUTH_CLIENT_ID_IOS;
  if (prodIosClientId) {
    const prodClientId = prodIosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    const prodScheme = `com.googleusercontent.apps.${prodClientId}`;
    if (!schemes.includes(prodScheme)) {
      schemes.push(prodScheme);
    }
  }
  
  const devIosClientId = envDev.GOOGLE_OAUTH_CLIENT_ID_IOS_DEV;
  if (devIosClientId) {
    const devClientId = devIosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    const devScheme = `com.googleusercontent.apps.${devClientId}`;
    if (!schemes.includes(devScheme)) {
      schemes.push(devScheme);
    }
  }
  
  const devFallbackIosClientId = envDev.GOOGLE_OAUTH_CLIENT_ID_IOS;
  if (devFallbackIosClientId && devFallbackIosClientId !== prodIosClientId) {
    const fallbackClientId = devFallbackIosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    const fallbackScheme = `com.googleusercontent.apps.${fallbackClientId}`;
    if (!schemes.includes(fallbackScheme)) {
      schemes.push(fallbackScheme);
    }
  }
  
  return schemes;
}

const reversedClientId = getReversedClientId();
const allUrlSchemes = getAllReversedClientIds();

module.exports = {
  expo: {
    name: 'MyBreakPoint',
    slug: 'mybreakpoint',
    owner: 'mybreakpoint',
    version: appVersion,
    scheme: 'mybreakpoint',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera for live streaming.',
          microphonePermission: 'Allow $(PRODUCT_NAME) to access your microphone for live streaming audio.',
          recordAudioAndroid: true,
        },
      ],
      [
        'expo-video',
        {
          supportsBackgroundPlayback: true,
          supportsPictureInPicture: true,
        },
      ],
      [
        'expo-audio',
        {
          enableBackgroundPlayback: true,
        },
      ],
      'expo-router',
      'expo-notifications',
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: reversedClientId,
        },
      ],
      './plugins/withNodePath',
      ['expo-live-activity', { enablePushNotifications: true }],
      [
        './plugins/withIdentitySettings',
        {
          version: appVersion,
          buildNumber: buildNumber,
          displayName: 'MyBreakPoint',
          category: 'public.app-category.sports',
        },
      ],
      './plugins/withAndroidSigning',
      'react-native-iap',
    ],
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#020617'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'app.mybreakpoint',
      appleTeamId: 'BZHS36ZMFQ',
      backgroundColor: '#020617',
      buildNumber: buildNumber,
      splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#020617'
      },
      infoPlist: {
        UIBackgroundModes: ['remote-notification', 'audio'],
        LSApplicationCategoryType: 'public.app-category.sports',
        NSPhotoLibraryUsageDescription: 'We use your photos so you can upload and share images with your team.',
        NSPhotoLibraryAddUsageDescription: 'We save images you choose to export or download to your library.',
        NSCameraUsageDescription: 'We use the camera for live match streaming and for capturing photos to share with your team.',
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: allUrlSchemes,
          },
        ],
      },
      associatedDomains: [
        'applinks:mybreakpoint.app',
        ...(isRelease ? [] : ['applinks:mybreakpoint.app?mode=developer']),
      ],
      entitlements: {
        'aps-environment': isRelease ? 'production' : 'development',
        'com.apple.developer.applesignin': ['Default'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/icon-foreground-android.png',
        backgroundColor: '#020617'
      },
      splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#020617'
      },
      predictiveBackGestureEnabled: false,
      backgroundColor: '#020617',
      navigationBar: {
        backgroundColor: '#000000',
        barStyle: 'light-content'
      },
      package: 'app.mybreakpoint',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'mybreakpoint.app', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      usesCleartextTraffic: true,
      permissions: [
        'INTERNET',
        'ACCESS_NETWORK_STATE',
        'android.permission.WAKE_LOCK',
        'android.permission.POST_NOTIFICATIONS',
        'CAMERA',
        'RECORD_AUDIO',
        'android.permission.SCHEDULE_EXACT_ALARM',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
        'android.permission.FOREGROUND_SERVICE_CAMERA',
        'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      ],
      versionCode: parseInt(process.env.ANDROID_VERSION_CODE || buildNumber, 10)
    },
    web: {
      favicon: './assets/favicon.png',
      themeColor: '#020617',
      description: 'MyBreakPoint — tennis, pickleball & padel stats, team tools, live match viewing, and AI insights.'
    },
    backgroundColor: '#020617',
    extra: {
      ...extra,
      VITE_PUBLIC_POSTHOG_KEY: extra.VITE_PUBLIC_POSTHOG_KEY || 'phc_11WKqFP1MmN9WqOh12G4RZS4sVoN3FisADH4B4yBLH8',
      VITE_PUBLIC_POSTHOG_HOST: extra.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      eas: {
        projectId: 'b7fc7b04-f2c4-424f-aabd-81a333100cd0',
      },
    }
  }
};
