/**
 * injectScript - Inject internal script to available access to the `window`
 *
 * @param  {type} file_path Local path of the internal script.
 * @param  {type} tag The tag as string, where the script will be append (default: 'body').
 * @see    {@link http://stackoverflow.com/questions/20499994/access-window-variable-from-content-script}
 */
function injectScript(file_path, tag) {
  var node = document.getElementsByTagName(tag)[0];
  var script = document.createElement("script");
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", file_path);
  node.appendChild(script);
}

injectScript("https://unpkg.com/prettier@1.19.1/standalone.js", "body");
injectScript("https://unpkg.com/prettier@1.19.1/parser-babylon.js", "body");
injectScript(chrome.extension.getURL("dist/content.js"), "body");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse({ pong: true });
  document.dispatchEvent(new CustomEvent("toggleSketchPane", message));
});
