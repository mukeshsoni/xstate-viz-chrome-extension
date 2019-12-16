chrome.runtime.onInstalled.addListener(function() {
  chrome.tabs.onUpdated.addListener((tabId, data, tab) => {
    if (tab.url.includes("xstate.js.org") || tab.url.includes("localhost")) {
      console.log("will show page action now");
      chrome.pageAction.show(tabId);
    }
  });

  chrome.pageAction.onClicked.addListener(function() {
    console.log("page action clicked");

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { togglePane: true }, function(
        response
      ) {
        console.log("got response", response);
      });
    });
  });
});
