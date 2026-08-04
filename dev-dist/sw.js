/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-d2f107b2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "0.uaflgc7scbg"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    allowlist: [/^\/$/],
    denylist: [/^\/api\//, /^\/iframe-check/, /^\/404/, /^\/finder$/, /^\/soundboard$/, /^\/internet-explorer(\/|$)/, /^\/chats$/, /^\/textedit$/, /^\/paint$/, /^\/photo-booth$/, /^\/minesweeper$/, /^\/videos(\/|$)/, /^\/ipod(\/|$)/, /^\/synth$/, /^\/pc$/, /^\/terminal$/, /^\/applet-viewer(\/|$)/, /^\/control-panels$/]
  }));
  workbox.registerRoute(({
    request
  }) => request.mode === "navigate", new workbox.NetworkFirst({
    "cacheName": "html-pages",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\.js(?:\?.*)?$/i, new workbox.NetworkFirst({
    "cacheName": "js-resources",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\.css(?:\?.*)?$/i, new workbox.StaleWhileRevalidate({
    "cacheName": "css-resources",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 604800
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp|ico)(?:\?.*)?$/i, new workbox.CacheFirst({
    "cacheName": "images",
    "matchOptions": {
      "ignoreSearch": true
    },
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 200,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:woff|woff2|ttf|otf|eot)(?:\?.*)?$/i, new workbox.CacheFirst({
    "cacheName": "fonts",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 30,
      maxAgeSeconds: 31536000
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:mp3|wav|ogg|m4a)(?:\?.*)?$/i, new workbox.CacheFirst({
    "cacheName": "audio",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');
  workbox.registerRoute(/\/data\/.*\.json$/i, new workbox.NetworkFirst({
    "cacheName": "data-files",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\/(icons|wallpapers)\/manifest\.json$/i, new workbox.NetworkFirst({
    "cacheName": "manifests",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 5,
      maxAgeSeconds: 86400
    })]
  }), 'GET');
  workbox.registerRoute(/\/wallpapers\/(?:photos|tiles)\/.+\.(?:jpg|jpeg|png|webp)(?:\?.*)?$/i, new workbox.CacheFirst({
    "cacheName": "wallpapers",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');

}));
