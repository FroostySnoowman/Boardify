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
      'expo-router',
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
          displayName: 'MyBreakPoint',
          category: 'public.app-category.sports',
        },
      ],
      './plugins/withAndroidSigning',
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
        UIBackgroundModes: ['remote-notification'],
        LSApplicationCategoryType: 'public.app-category.sports',
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
        'android.permission.POST_NOTIFICATIONS',
      ],
      versionCode: parseInt(process.env.ANDROID_VERSION_CODE || buildNumber, 10)
    },
    web: {
      favicon: './assets/favicon.png',
      themeColor: '#020617',
      description: 'MyBreakPoint — a modern React Native template.'
    },
    backgroundColor: '#020617',
    extra: {
      ...extra,
      eas: {
        projectId: 'b7fc7b04-f2c4-424f-aabd-81a333100cd0',
      },
    }
  }
};
