const fs = require('fs');
const path = require('path');

const isRelease = process.env.EXPO_PUBLIC_BUILD_ENV === 'production' || process.env.NODE_ENV === 'production';
const appVersion = '0.0.1';
const buildNumber = process.env.BUILD_NUMBER || '195';

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
  const schemes = ['boardify'];
  
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
    name: 'Boardify',
    slug: 'boardify',
    owner: 'boardify',
    version: appVersion,
    scheme: 'boardify',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          enableBackgroundRemoteNotifications: true,
        },
      ],
      '@react-native-community/datetimepicker',
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: reversedClientId,
        },
      ],
      './plugins/withNodePath',
      [
        './plugins/withIdentitySettings',
        {
          version: appVersion,
          buildNumber: buildNumber,
          displayName: 'Boardify',
          category: 'public.app-category.sports',
        },
      ],
      './plugins/withAndroidSigning',
    ],
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#f5f0e8'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'app.mybreakpoint.boardify',
      appleTeamId: 'BZHS36ZMFQ',
      backgroundColor: '#f5f0e8',
      buildNumber: buildNumber,
      splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#f5f0e8'
      },
      infoPlist: {
        UIBackgroundModes: ['remote-notification'],
        LSApplicationCategoryType: 'public.app-category.sports',
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: allUrlSchemes,
          },
        ],
      },
      associatedDomains: [
        'applinks:app.mybreakpoint.boardify',
        ...(isRelease ? [] : ['applinks:app.mybreakpoint.boardify?mode=developer']),
      ],
      entitlements: {
        'aps-environment': isRelease ? 'production' : 'development',
        'com.apple.developer.applesignin': ['Default'],
      },
    },
    android: {
      softwareKeyboardLayoutMode: 'pan',
      adaptiveIcon: {
        foregroundImage: './assets/icon-foreground-android.png',
        backgroundColor: '#f5f0e8'
      },
      splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#f5f0e8'
      },
      predictiveBackGestureEnabled: false,
      backgroundColor: '#f5f0e8',
      navigationBar: {
        backgroundColor: '#f5f0e8',
        barStyle: 'dark-content'
      },
      package: 'app.mybreakpoint.boardify',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'app.mybreakpoint.boardify', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      usesCleartextTraffic: true,
      permissions: [
        'INTERNET',
        'ACCESS_NETWORK_STATE',
        'android.permission.POST_NOTIFICATIONS',
      ],
      versionCode: parseInt(process.env.ANDROID_VERSION_CODE || buildNumber, 10)
    },
    web: {
      favicon: './assets/favicon.png',
      themeColor: '#f5f0e8',
      description: 'Boardify — collaborative boards, lists, and cards.'
    },
    backgroundColor: '#f5f0e8',
    extra: {
      ...extra,
      eas: {
        projectId: 'b7fc7b04-f2c4-424f-aabd-81a333100cd0',
      },
    }
  }
};
