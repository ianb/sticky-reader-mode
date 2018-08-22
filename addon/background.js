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
  }
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
    console.log("got recent redirect");
  }
  console.log("got update?", url, changeInfo.url, newTabInfo.url);
  if (!url) {
    // Then the URL didn't update
    return;
  }
  if (url.startsWith("about:reader")) {
    // We can't use manifest.json content_scripts on about:reader, as the matcher doesn't work. But we can inject it here:
    console.log("Added worker to about:reader page");
    await browser.tabs.executeScript(tabId, {
      file: "reader-script.js"
    });
    console.log("completed loading worker");
    let origUrl = readerUrlToNormal(url);
    let pat = makeUrlPattern(origUrl);
    let domain = makeDomain(origUrl);
    browser.tabs.sendMessage(tabId, {
      type: "setValue",
      checked: !!(readableHostnames[pat] || readableHostnames[domain])
    });
    lastReadable.set(tabId, origUrl);
  } else {
    if (url === lastReadable.get(tabId)) {
      console.info("User exited reader mode on tab:", tabId, url);
      return;
    }
    let pat = makeUrlPattern(url);
    let domain = makeDomain(url);
    let readable = readableHostnames[pat] || readableHostnames[domain];
    if (readable && newTabInfo.isArticle) {
      console.info("Turning reader mode on for", url);
      await browser.tabs.toggleReaderMode(tabId);
    }
  }
}));

browser.webRequest.onBeforeRequest.addListener((event) => {
  let url = event.url;
  let pat = makeUrlPattern(url);
  if (readableHostnames[pat]) {
    setTimeout(() => {
      console.info("Automatically readering", url);
      recentRedirects.set(event.tabId, url);
      browser.openInReaderMode.open(event.tabId, url);
    }, 1000);
    console.info("Cancelled load", url);
    return {cancel: true};
  }
  return {};
}, {urls: ["http://*/*", "https://*/*"], types: ["main_frame"]}, ["blocking"]);

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
      readableHostnames[pat] = true;
      readableHostnames[domain] = true;
      console.info("Default reader mode on", domain);
    } else {
      delete readableHostnames[pat];
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
  console.log("has API?", typeof browser.openInReaderMode, typeof browser.openInReaderMode.open);
}

init();
