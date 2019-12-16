chrome.runtime.onInstalled.addListener(function() {
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
