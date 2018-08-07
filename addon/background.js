let readableHostnames = {};
let lastReadable = new Map();

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, newTabInfo) => {
  let url = changeInfo.url;
  if (changeInfo.isArticle && !url) {
    // We recently found we can use the article view
    url = newTabInfo.url;
  }
  if (!url) {
    // Then the URL didn't update
    return;
  }
  if (url.startsWith("about:reader")) {
    // We can't use manifest.json content_scripts on about:reader, as the matcher doesn't work. But we can inject it here:
    await browser.tabs.executeScript(tabId, {
      file: "reader-script.js"
    });
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
});

/*
browser.webRequest.onBeforeRequest.addListener((event) => {
  let url = event.url;
  let pat = makeUrlPattern(url);
  if (readableHostnames[pat]) {
    let newUrl = `about:reader?url=${encodeURIComponent(url)}`;
    setTimeout(() => {
      browser.tabs.toggleReaderMode(event.tabid);
      // FIXME: you can't use this to redirect to about:reader
      browser.tabs.update(event.tabId, {url: newUrl});
    }, 1000);
    return {cancel: true};
  }
  return {};
}, {urls: ["http://*" + "/*", "https://*" + "/*"], types: ["main_frame"]}, ["blocking"]);
*/

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
}

init();
