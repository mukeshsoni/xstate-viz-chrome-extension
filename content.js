import { parse } from "./parser/parser";
import { Element, div, Button, Input } from "./components";

const MIN_WIDTH = 200;
const MAX_WIDTH = 1000;
let EDITOR_WIDTH = 400;

const errorPaneId = "sketch-systems-error-pane";
const successPaneId = "sketch-systems-success-message";
const sketchSystemsEditorId = "sketch-systems-editor";
const sketchSystemsSuccessPaneId = "sketch-systems-success-message";
const errorDivId = "sketch-systems-error-pane";

let header = document.querySelector("header");
const headerHeight = header.clientHeight;
let drawingSection = document.querySelector("section");

export function HideButton() {
  return Button(
    {
      id: "sketch-hide-editor-button",
      style: {
        width: "auto",
        "z-index": 4,
        "border-radius": "10px",
        padding: "5px 10px",
        "margin-left": "20px",
        border: "1px solid white"
      }
    },
    ["Hide"]
  );
}

function clearErrorPane() {
  const errorPane = document.getElementById(errorPaneId);

  errorPane.innerHTML = "";
}

function showSuccessMessagePane() {
  const successMessagePane = document.getElementById(successPaneId);

  successMessagePane.style.display = "block";
}

function commentEveryLine(str) {
  return (
    "// sketch-systems like statechart description\n\n" +
    str
      .split(/[\n\r]/)
      .map(s => `// ${s}`)
      .join("\n")
  );
  // return str;
}

function clickXstateEditorUpdateButton() {
  const buttons = document.querySelectorAll("button");

  const updateButton = Array.from(buttons).find(
    b => b.textContent.toLowerCase() === "update"
  );

  if (updateButton && updateButton.click) {
    updateButton.click();
  }
}

function updateXstateEditor() {
  var editor = ace.edit("sketch-systems-editor");
  const inputStr = editor.getValue();

  const machineConfig = parse(inputStr);

  if (machineConfig.error) {
    console.error("Error parsing string", machineConfig.error);
    showError(machineConfig.error);
  } else {
    clearErrorPane();
    showSuccessMessagePane();
    const xstateEditor = ace.edit("brace-editor");
    const outputText = `const machine = Machine(${JSON.stringify(
      machineConfig,
      null,
      2
    )})`;
    xstateEditor.setValue(
      `${commentEveryLine(inputStr)}\n\n ${outputText}`,
      -1
    );

    clickXstateEditorUpdateButton();
  }
}

export function TransformButton() {
  const sketchUpdateButton = Button(
    {
      id: "sketch-update-button"
    },
    ["Transform"]
  );

  sketchUpdateButton.addEventListener("click", updateXstateEditor);

  return sketchUpdateButton;
}

const transformButtonContainer = div(
  {
    style: {
      width: "100%",
      padding: "10px"
    }
  },
  [TransformButton()]
);

function WidthInput() {
  return Element(
    "label",
    {
      style: {
        display: "flex",
        border: "1px solid white",
        padding: "3px 10px"
      }
    },
    [
      "Width",
      Input({
        id: "sketch-systems-width-input",
        type: "range",
        min: MIN_WIDTH,
        max: MAX_WIDTH,
        value: EDITOR_WIDTH,
        style: {
          "margin-left": "10px",
          width: "70px"
        }
      })
    ]
  );
}

export function Toolbar() {
  const headerStyles = {
    background: "rgb(101, 101, 101)",
    padding: "5px 10px",
    color: "white",
    display: "flex",
    "flex-direction": "row-reverse",
    "align-items": "center"
  };

  return Element("header", { style: headerStyles }, [
    HideButton(),
    WidthInput()
  ]);
}

const editorDiv = div({
  id: sketchSystemsEditorId,
  style: {
    flex: 1
  }
});

const successDiv = div(
  {
    id: sketchSystemsSuccessPaneId,
    style: {
      color: "green",
      display: "none",
      "overflow-wrap": "break-word"
    }
  },
  ["Transformed successfully!"]
);

const errorDiv = div({
  id: errorDivId,
  style: {
    color: "red"
  }
});

function getEditorRight() {
  return (
    window.innerWidth -
    document
      .getElementById("brace-editor")
      .parentNode.parentNode.getBoundingClientRect().right +
    document
      .getElementById("brace-editor")
      .parentNode.parentNode.getBoundingClientRect().width
  );
}

const paneChildren = [
  Toolbar(),
  editorDiv,
  successDiv,
  errorDiv,
  transformButtonContainer
];

let extensionPane = div(
  {
    style: {
      position: "fixed",
      width: `${EDITOR_WIDTH}px`,
      height: `calc(100vh - ${headerHeight}px)`,
      right: `${getEditorRight()}px`,
      top: `${headerHeight}px`,
      "font-size": "16px",
      display: "flex",
      "flex-direction": "column"
    }
  },
  paneChildren
);

// drawingSection.parentNode.insertBefore(extensionPane, drawingSection.nextSibling);
document.body.appendChild(extensionPane);

let editor = ace.edit(sketchSystemsEditorId);
editor.setTheme("ace/theme/monokai");
// editor.session.setMode("ace/mode/javascript");
editor.focus();

function hideSuccessMessagePane() {
  const successMessagePane = document.getElementById(
    sketchSystemsSuccessPaneId
  );

  successMessagePane.style.display = "none";
}

function showError(error) {
  hideSuccessMessagePane();
  const errorPane = document.getElementById("sketch-systems-error-pane");

  errorPane.innerHTML = `<div>${error.message}</div><div>Line no: ${error.token.line}, Column no: ${error.token.col}</div>`;
}

function toggleEditorVisibility() {
  // if i use display: 'none' to hide the div, the ace editor
  // does not show up when i then change it back to display: 'block'
  // so using visibility property instead
  if (extensionPane.style.visibility === "visible") {
    extensionPane.style.visibility = "hidden";
  } else {
    extensionPane.style.visibility = "visible";
  }
}

const sketchHideEditorButton = document.getElementById(
  "sketch-hide-editor-button"
);

sketchHideEditorButton.addEventListener("click", toggleEditorVisibility);

function hydrateEditorFromCache() {
  const cachedStatechart = localStorage.getItem(
    "sketch-systems-xstate-transformer"
  );

  if (cachedStatechart) {
    // the second param 1 ensures that the whole text is not selected, which
    // is the default behavior of ace editor
    // 1 puts the cursor to the end of pasted value
    editor.setValue(cachedStatechart, 1);
  }
}

hydrateEditorFromCache();

function saveToLocalStorage() {
  localStorage.setItem(
    "sketch-systems-xstate-transformer",
    editor.getValue() || ""
  );
}

editor.on("change", () => {
  saveToLocalStorage();
  hideSuccessMessagePane();
});

function adjustEditorPosition() {
  extensionPane.style.right = `${getEditorRight()}px`;
}

// in the xstate-editor the show/hide of the editor pane is done by
// changing the data-layout attribute of the main tag
// we want to reposition our editor based on change to that attribute
var observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (
      mutation.type == "attributes" &&
      mutation.attributeName === "data-layout"
    ) {
      setTimeout(adjustEditorPosition, 500);
    }
  });
});

const mainElement = document.querySelector("main");
observer.observe(mainElement, {
  attributes: true //configure it to listen to attribute changes
});

const widthInputElement = document.getElementById("sketch-systems-width-input");

widthInputElement.addEventListener("change", () => {
  let newWidth = widthInputElement.value;

  newWidth = parseInt(newWidth, 10);

  if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
    EDITOR_WIDTH = newWidth;
    extensionPane.style.width = `${EDITOR_WIDTH}px`;
  } else {
    console.log(`width has to be between ${MIN_WIDTH} and ${MAX_WIDTH} pixels`);
  }
});

console.log(chrome.runtime);
document.addEventListener("toggleSketchPane", toggleEditorVisibility);
// chrome.runtime.onMessage.addListener(request => {
// if (request.togglePane) {
// toggleEditorVisibility();
// }
// });
