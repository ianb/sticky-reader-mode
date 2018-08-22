/* global ExtensionAPI:false */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

function getTabOrActive(tabId) {
  let tabTracker = ChromeUtils.import("resource://gre/modules/Extension.jsm", {}).Management.global.tabTracker;
  if (tabId !== null) {
    return tabTracker.getTab(tabId);
  }
  return tabTracker.activeTab;
}

this.openInReaderMode = class API extends ExtensionAPI {
  getAPI(context) {
    return {
      openInReaderMode: {
        open(tabId, url) {
          console.log("going to open in reader mode:", tabId, url);
          // eslint-disable-next-line mozilla/use-services
          let nativeTab = getTabOrActive(tabId);
          url = context.uri.resolve(url);
          if (!context.checkLoadURL(url, {dontReportErrors: true})) {
            return Promise.reject({message: `Illegal URL: ${url}`});
          }
          url = `about:reader?url=${encodeURIComponent(url)}`;
          let options = {
            triggeringPrincipal: context.principal,
          };
          nativeTab.linkedBrowser.loadURI(url, options);
          return true;
        }
      }
    };
  }
};
