import { parse } from "../sketch-systems-to-xstate-parser/parser";

let fancyEditor = document.createElement("div");
let header = document.querySelector("header");
const headerHeight = header.clientHeight;

const EDITOR_WIDTH = "400px";
fancyEditor.style = `position: fixed; width: ${EDITOR_WIDTH}; height: calc(100vh - ${headerHeight}px); right: 400px; top: ${headerHeight}px; font-size: 16px; display: flex; flex-direction: column`;

const buttonStyle = {
  width: "100%",
  "text-align": "center",
  height: "2rem",
  color: "white",
  "text-transform": "uppercase",
  "font-weight": "bold",
  background: "rgb(101, 101, 101)",
  border: "none",
  cursor: "pointer"
};

function styleMap(styles) {
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join(";");
}

const updateButtonHtml = `
  <button 
      id="sketch-update-button"
      style="${styleMap(buttonStyle)}"
  >
    Transform
  </button>
`;

// new
const hideButtonHtml = `
  <button
    id="sketch-hide-editor-button"
      style="${styleMap(buttonStyle)};
        width: auto;
        position: absolute;
        right: 0;
        z-index: 4;
        border-radius: 10px 0 0 10px;
        padding: 10px;
        top: 10px;
      ">
    Hide
  </button>
`;

fancyEditor.innerHTML = `
  <div id="sketch-systems-editor" style="flex: 1"></div>
  <div style="width: 100%; padding: 10px; ">
    ${updateButtonHtml}
  </div>
  ${hideButtonHtml}
`;

let drawingSection = document.querySelector("section");

// drawingSection.parentNode.insertBefore(fancyEditor, drawingSection.nextSibling);
document.body.appendChild(fancyEditor);

var editor = ace.edit("sketch-systems-editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/python");
editor.focus();

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

function updateXstateEditor() {
  const inputStr = editor.getValue();

  const machineConfig = parse(inputStr);

  if (machineConfig.error) {
    console.error("Error parsing string", machineConfig.error);
  } else {
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

function clickXstateEditorUpdateButton() {
  const buttons = document.querySelectorAll("button");

  const updateButton = Array.from(buttons).find(
    b => b.textContent.toLowerCase() === "update"
  );

  if (updateButton && updateButton.click) {
    updateButton.click();
  }
}

const sketchUpdateButton = document.getElementById("sketch-update-button");
sketchUpdateButton.addEventListener("click", updateXstateEditor);

function toggleEditorVisibility() {
  if (fancyEditor.clientWidth < 50) {
    fancyEditor.style.width = EDITOR_WIDTH;
  } else {
    fancyEditor.style.width = "40px";
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

editor.on("change", saveToLocalStorage);
