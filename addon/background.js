let readableHostnames = {};
let lastReadable = new Map();
let recentRedirects = new Map();

function reporter(func) {
  return async function(...args) {
    try {
      return func.apply(this, args);
    } catch (e) {
      console.error("Error in function:", e);
      console.error(e.stack);
      throw e;
    }
  };
}

browser.tabs.onUpdated.addListener(reporter(async (tabId, changeInfo, newTabInfo) => {
  let url = changeInfo.url;
  if (changeInfo.isArticle && !url) {
    // We recently found we can use the article view
    url = newTabInfo.url;
  }
  if (recentRedirects.get(tabId)) {
    url = newTabInfo.url;
    recentRedirects.clear();
  }
  // console.info("Tab update:", url, changeInfo.url, newTabInfo.url);
  if (!url) {
    // Then the URL didn't update
    return;
  }
  if (url.startsWith("about:reader")) {
    // We can't use manifest.json content_scripts on about:reader, as the matcher doesn't work. But we can inject it here:
    // Sometimes executeScript just stalls, this at least emits an error message in that case:
    let timeoutId = setTimeout(() => {
      console.error("Could not attach content script to about:reader", tabId, url);
    }, 2000);
    await browser.tabs.executeScript(tabId, {
      file: "reader-script.js"
    });
    clearTimeout(timeoutId);
    let origUrl = readerUrlToNormal(url);
    let domain = makeDomain(origUrl);
    browser.tabs.sendMessage(tabId, {
      type: "setValue",
      checked: !!readableHostnames[domain]
    });
    lastReadable.set(tabId, origUrl);
  } else {
    if (url === lastReadable.get(tabId)) {
      console.info("User exited reader mode on tab, no reader toggle:", tabId, url);
      return;
    }
    lastReadable.delete(tabId);
    let domain = makeDomain(url);
    let readable = readableHostnames[domain];
    if (readable && newTabInfo.isArticle) {
      console.info("Turning reader mode on for:", url, "and remembering:", makeUrlPattern(url));
      readableHostnames[domain][makeUrlPattern(url)] = true;
      saveHostnames();
      await browser.tabs.toggleReaderMode(tabId);
    }
  }
}));

if (browser.openInReaderMode && browser.openInReaderMode.open) {
  browser.webRequest.onBeforeRequest.addListener((event) => {
    let tabId = event.tabId;
    let url = event.url;
    let domain = makeDomain(url);
    let pat = makeUrlPattern(url);
    if (readableHostnames[domain] && readableHostnames[domain][pat]) {
      if (url === lastReadable.get(tabId)) {
        console.info("User exited reader mode on tab, no automatic redirect:", tabId, url);
        return {};
      }
      lastReadable.delete(tabId);
      console.info("Redirecting request to reader mode:", url);
      setTimeout(() => {
        recentRedirects.set(tabId, url);
        lastReadable.set(tabId, url);
        browser.openInReaderMode.open(tabId, url);
      });
      return {cancel: true};
    }
    if (domain && !readableHostnames[domain]) {
      lastReadable.delete(tabId);
    }
    return {};
  }, {urls: ["http://*/*", "https://*/*"], types: ["main_frame"]}, ["blocking"]);
} else {
  console.error("Sticky Readable error: browser.openInReaderMode API was not loaded");
}

function makeUrlPattern(url) {
  if (url.includes("?p=")) {
    // A WordPress-specific pattern...
    url = url.replace(/\?p=([^&]*)&?/, (m) => "/" + m[1] + "?");
  }
  let urlObj = new URL(url);
  let path = urlObj.pathname.replace(/\/\/+/g, "/");
  path = path.replace(/\/[^/]+/g, "/*");
  return urlObj.hostname + path;
}

function makeDomain(url) {
  return (new URL(url)).hostname;
}

function readerUrlToNormal(url) {
  if (!url.startsWith("about:reader?")) {
    throw new Error("Bad Reader URL");
  }
  let match = /url=([^&"?]+)/.exec(url);
  if (!match) {
    throw new Error("Reader URL doesn't have url= param");
  }
  return decodeURIComponent(match[1]);
}

async function saveHostnames() {
  await browser.storage.sync.set({readableHostnames});
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "setValue") {
    let url = sender.tab.url;
    let pat = makeUrlPattern(readerUrlToNormal(url));
    let domain = makeDomain(readerUrlToNormal(url));
    if (message.checked) {
      readableHostnames[domain] = {[pat]: true};
      console.info("Default reader mode on", domain);
    } else {
      // FIXME: should iterate all hostnames for any additional patterns
      delete readableHostnames[domain];
      console.info("Removing default reader mode on", domain);
    }
    saveHostnames();
  } else {
    console.warn("Received unexpected message:", message);
  }
});

async function init() {
  let result = await browser.storage.sync.get(["readableHostnames"]);
  if (result) {
    readableHostnames = result.readableHostnames || {};
  }
  console.info("Loaded sticky readable hosts:", Object.keys(readableHostnames).join(", "));
  for (let tab of await browser.tabs.query({})) {
    let url = tab.url;
    if (url.startsWith("about:reader")) {
      let origUrl = readerUrlToNormal(url);
      lastReadable.set(tab.id, origUrl);
    }
  }
}

init();
