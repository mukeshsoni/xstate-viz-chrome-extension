import init, { parse } from "./parser_rust/pkg/parser_rust.js";
import ace from "brace";
import "brace/theme/monokai";
// custom ace mode for highlighting our language
import "./ace_mode_sketch";
import { Element, div, Button, Input } from "./components";

const MIN_WIDTH = 200;
const MAX_WIDTH = 1000;
let EDITOR_WIDTH = 400;
let EDITOR_HEIGHT_RATIO = 50;

const errorPaneId = "sketch-systems-error-pane";
const successPaneId = "sketch-systems-success-message";
const sketchSystemsEditorId = "sketch-systems-editor";
const sketchSystemsJsEditorId = "sketch-systems-js-editor";
const sketchSystemsSuccessPaneId = "sketch-systems-success-message";
const errorDivId = "sketch-systems-error-pane";
const mainEditorContainerId = "main-editor-container";
const jsEditorContainerId = "js-editor-container";

let header = document.querySelector("header");
const headerHeight = header.clientHeight;
let drawingSection = document.querySelector("section");

// to use the webworker with rollup, i had to use a plugin
// rollup-plugin-web-worker-loader
// It requires that we load the worker using the syntax below
// import myWorker from "comlink-loader!./worker";
// const worker = myWorker();
// initialize the web worker and provide a simple api courtesy of comlink
// const parse = Comlink.wrap(worker);

// IMPORTANT - This is the key step to loading the wasm bundle generated
// by wasm-pack. The init function exported by wasm-pack (using --target build)
// helps us load the wasm modules easily. And it also somehow makes sure that
// the imported `parse` function from that module works.
// await init() ensures that we load the wasm module asynchronously, which is
// a hard requirement right now in all browsers.
async function run() {
  await init();

  console.log("run", parse("abc"));
}

run();

export function HideButton() {
  return Button(
    {
      id: "sketch-hide-editor-button",
      style: {
        background: "#272722",
        "margin-left": "10px",
        height: "100%",
      },
    },
    ["Hide"]
  );
}

function FormatButton() {
  const b = Button(
    {
      style: {
        background: "#272722",
        "margin-left": "10px",
        height: "100%",
      },
    },
    ["Format JS"]
  );

  b.addEventListener("click", () => {
    jsEditor.setValue(getFormattedJsCode(), 1);
  });

  return b;
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
      .map((s) => `// ${s}`)
      .join("\n")
  );
  // return str;
}

function clickXstateEditorUpdateButton() {
  const buttons = document.querySelectorAll("button");

  const updateButton = Array.from(buttons).find(
    (b) => b.textContent.toLowerCase() === "update"
  );

  if (updateButton && updateButton.click) {
    updateButton.click();
  }
}

function getFormattedJsCode() {
  let formattedJsCode = jsEditor.getValue();
  // have injected prettier standalone in the inject script. When the extension loads
  if (prettier && prettierPlugins && jsEditor.getValue()) {
    try {
      formattedJsCode = prettier.format(jsEditor.getValue(), {
        parser: "babylon",
        plugins: prettierPlugins,
      });
    } catch (e) {
      console.log("Could not format js code", e);
    }
  }

  return formattedJsCode;
}

// we generate an array of events from our parser. It looks like this
// on: [
//    {
//      event: string;
//      target: string;
//      cond?: string;
//      actions?: Array<string>;
//    }
// ]
//
// We want to convert it to an object of key value pairs. The most common usage
// is { on: { eventName: targetName }}
// But we will use a little more generic represenatation so that it accomodates
// more cases, like event with condition and actions
// on: {
//    [eventName: string]: {
//      target: string;
//      cond?: string;
//      actions?: Array<string>;
//    }
// }
// There is one special case - transient transition. It has an empty string as
// the event name. We create an array of objects against the empty string as
// event name
// on: {
//    "": [
//      {
//        target: string;
//        cond: string;
//        actions?: Array<string>;
//      },
//      {
//        target: string;
//        cond: string;
//        actions?: Array<string>;
//      }
//    ]
// }
function eventArrayToObj(eventsArr) {
  return eventsArr.reduce((acc, item) => {
    // in case of transient states, we will have { '': { target: 'abc', cond: xyz } } kind of transitions. And they need to be merged for all '' appearances
    // They need to be merged into an array
    if (!item.event) {
      return {
        ...acc,
        "": acc[""] ? acc[""].concat(item) : [item],
      };
    } else {
      return { ...acc, [item.event]: item };
    }
  }, {});
}

function transformEventsArrayToObjStructure(stateNode) {
  return {
    ...stateNode,
    on: eventArrayToObj(stateNode.on),
    states: stateNode.states
      ? Object.fromEntries(
          Object.entries(stateNode.states).map(([stateName, node]) => [
            stateName,
            transformEventsArrayToObjStructure(node),
          ])
        )
      : undefined,
  };
}

async function updateXstateEditor() {
  var editor = ace.edit("sketch-systems-editor");
  const inputStr = editor.getValue();

  jsEditor.setValue(getFormattedJsCode(), 1);
  const jsInputStr = jsEditor.getValue();

  let machineConfigObj = await parse(inputStr.trim());

  machineConfigObj = transformEventsArrayToObjStructure(machineConfigObj);

  console.log({ machineConfigObj });
  if (machineConfigObj.error) {
    console.error("Error parsing string", machineConfigObj.error);
    showError({
      message: machineConfigObj.error.message,
      token: machineConfigObj.token,
    });
  } else {
    clearErrorPane();
    showSuccessMessagePane();
    const xstateEditor = ace.edit("brace-editor");
    const outputText = `const machineConfig = ${JSON.stringify(
      machineConfigObj,
      null,
      2
    )}

${jsInputStr ? jsInputStr : "Machine(machineConfig)"}
    `;
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
      id: "sketch-update-button",
      style: {
        height: "2rem",
      },
    },
    ["Transform"]
  );

  sketchUpdateButton.addEventListener("click", updateXstateEditor);

  return sketchUpdateButton;
}

const TransformButtonContainer = div(
  {
    style: {
      width: "100%",
      padding: "10px",
      "padding-bottom": "15px",
      background: "#272722",
    },
  },
  [TransformButton()]
);

const rangeInputLabelStyle = {
  display: "flex",
  "flex-direction": "column",
  "justify-content": "flex-start",
  border: "1px solid #888",
  padding: "3px 10px",
  "margin-left": "15px",
  "font-size": "0.7rem",
  "font-weight": "bold",
};

function WidthInput() {
  return Element(
    "label",
    {
      style: rangeInputLabelStyle,
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
          width: "70px",
        },
      }),
    ]
  );
}

function EditorHeightAdjuster() {
  const MIN_RATIO = 0;
  const MAX_RATIO = 100;

  const inputEl = Element(
    "label",
    {
      style: rangeInputLabelStyle,
    },
    [
      "Height ratio",
      Input({
        id: "editor-height-adjuster",
        type: "range",
        min: MIN_RATIO,
        max: MAX_RATIO,
        value: EDITOR_HEIGHT_RATIO,
        style: {
          width: "70px",
        },
      }),
    ]
  );

  inputEl.addEventListener("change", (e) => {
    const mainEditor = document.getElementById(mainEditorContainerId);
    const jsEditor = document.getElementById(jsEditorContainerId);

    const newRatio = e.target.value;

    mainEditor.style.flex = newRatio;
    jsEditor.style.flex = 100 - newRatio;
  });

  return inputEl;
}

export function Toolbar() {
  const headerStyles = {
    background: "rgb(101, 101, 101)",
    padding: "5px 10px",
    color: "white",
    display: "flex",
    "flex-direction": "row-reverse",
    "align-items": "center",
  };

  return Element("header", { style: headerStyles }, [
    HideButton(),
    FormatButton(),
    WidthInput(),
    EditorHeightAdjuster(),
  ]);
}

function EditorHeader(heading) {
  return Element(
    "header",
    {
      style: {
        background: "#272722",
        color: "#fff",
        padding: "5px 10px",
        "border-bottom": "1px solid #333333",
      },
    },
    [heading]
  );
}

function EditorContainer(id, heading, editorEl) {
  return div(
    {
      id,
      style: { display: "flex", "flex-direction": "column", flex: 1 },
    },
    [EditorHeader(heading), editorEl]
  );
}

const editorDiv = div({
  id: sketchSystemsEditorId,
  style: {
    flex: 1,
  },
});

const jsEditorDiv = div({
  id: sketchSystemsJsEditorId,
  style: {
    flex: 1,
  },
});

const successDiv = div(
  {
    id: sketchSystemsSuccessPaneId,
    style: {
      color: "green",
      display: "none",
      "overflow-wrap": "break-word",
    },
  },
  ["Transformed successfully!"]
);

const errorDiv = div({
  id: errorDivId,
  style: {
    color: "red",
  },
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
  EditorContainer(mainEditorContainerId, "Main editor", editorDiv),
  EditorContainer(jsEditorContainerId, "JS Editor", jsEditorDiv),
  successDiv,
  errorDiv,
  TransformButtonContainer,
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
      "flex-direction": "column",
      // hide the pane by default on page load
      visibility: "visible",
    },
  },
  paneChildren
);

// drawingSection.parentNode.insertBefore(extensionPane, drawingSection.nextSibling);
document.body.appendChild(extensionPane);

let editor = ace.edit(sketchSystemsEditorId);
editor.setTheme("ace/theme/monokai");
editor.setOption("useWorker", false);
// cmd-enter or ctrl-enter (on windows) should run the transformation
editor.commands.addCommand({
  name: "replace",
  bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
  exec: updateXstateEditor,
});

editor.session.setMode("ace/mode/sketch");
editor.focus();

let jsEditor = ace.edit(sketchSystemsJsEditorId);
jsEditor.setTheme("ace/theme/monokai");
jsEditor.session.setMode("ace/mode/javascript");
jsEditor.setValue("Machine(machineConfig)");

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

  // show the error in ace editor's gutter
  const a = editor.getSession().setAnnotations([
    {
      row: error.token.line - 1,
      column: error.token.col - 1,
      text: error.message,
      type: "error",
    },
  ]);
}

function findByText(elName, text) {
  const buttons = Array.from(document.querySelectorAll("button"));

  return buttons.find((b) => b.textContent === text);
}

function hideXstateEditor() {
  const hideButton = findByText("button", "Hide");
  if (hideButton) {
    hideButton.click();
  }
}

function toggleEditorVisibility() {
  // if i use display: 'none' to hide the div, the ace editor
  // does not show up when i then change it back to display: 'block'
  // so using visibility property instead
  if (extensionPane.style.visibility === "visible") {
    extensionPane.style.visibility = "hidden";
  } else {
    extensionPane.style.visibility = "visible";

    hideXstateEditor();
  }
}

const sketchHideEditorButton = document.getElementById(
  "sketch-hide-editor-button"
);

sketchHideEditorButton.addEventListener("click", toggleEditorVisibility);

function hydrateEditorFromCache() {
  try {
    const cachedStatechart = JSON.parse(
      localStorage.getItem("sketch-systems-xstate-transformer")
    );

    if (cachedStatechart) {
      // the second param 1 ensures that the whole text is not selected, which
      // is the default behavior of ace editor
      // 1 puts the cursor to the end of pasted value
      editor.setValue(cachedStatechart.mainEditor || "", 1);
      jsEditor.setValue(cachedStatechart.jsEditor || "", 1);
    }
  } catch (e) {
    console.log("Nothing was saved to local storage it seems");
  }
}

hydrateEditorFromCache();

function saveToLocalStorage() {
  localStorage.setItem(
    "sketch-systems-xstate-transformer",
    JSON.stringify({
      mainEditor: editor.getValue() || "",
      jsEditor: jsEditor.getValue() || "",
    })
  );
}

editor.on("change", () => {
  saveToLocalStorage();
  hideSuccessMessagePane();
});

jsEditor.on("change", saveToLocalStorage);

function adjustEditorPosition() {
  extensionPane.style.right = `${getEditorRight()}px`;
}

// in the xstate-editor the show/hide of the editor pane is done by
// changing the data-layout attribute of the main tag
// we want to reposition our editor based on change to that attribute
var observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
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
  attributes: true, //configure it to listen to attribute changes
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

document.addEventListener("toggleSketchPane", toggleEditorVisibility);

// setTimeout(hideXstateEditor, 200);
