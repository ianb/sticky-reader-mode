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
          // eslint-disable-next-line mozilla/use-services
          let nativeTab = getTabOrActive(tabId);
          url = context.uri.resolve(url);
          if (!context.checkLoadURL(url, {dontReportErrors: true})) {
            return Promise.reject({message: `Illegal URL: ${url}`});
          }
          url = `about:reader?url=${encodeURIComponent(url)}`;
          let options = {
            disallowInheritPrincipal: true,
          };
          nativeTab.linkedBrowser.loadURI(url, options);
          return true;
        }
      }
    };
  }
};
