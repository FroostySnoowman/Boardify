const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: ["BZHS36ZMFQ.app.mybreakpoint"],
        components: [{ "/": "*", comment: "Match all URLs" }],
      },
      {
        appID: "BZHS36ZMFQ.app.mybreakpoint",
        paths: ["*"],
      },
    ],
  },
  activitycontinuation: { apps: ["BZHS36ZMFQ.app.mybreakpoint"] },
  webcredentials: { apps: ["BZHS36ZMFQ.app.mybreakpoint"] },
};

const ASSET_LINKS = [
  {
    relation: [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.get_login_creds"
    ],
    target: {
      namespace: "android_app",
      package_name: "app.mybreakpoint",
      sha256_cert_fingerprints: [
        "TODO:REPLACE_WITH_YOUR_SHA256_FINGERPRINT",
        "0F:41:0B:5D:17:53:35:C5:96:F2:D1:67:F4:DD:55:BA:40:A0:AB:2A:1A:6A:20:C9:B6:5B:B2:1C:AC:C8:A8:87"
      ],
    },
  },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/apple-app-site-association") {
      return new Response(JSON.stringify(AASA, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (url.pathname === "/.well-known/assetlinks.json") {
      return new Response(JSON.stringify(ASSET_LINKS, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status === 404 && !url.pathname.includes('.')) {
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }

    return response;
  },
};
