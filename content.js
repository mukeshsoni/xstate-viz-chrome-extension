import { parse } from "../sketch-systems-to-xstate-parser/parser";

console.log("custom extension read", parse);
let fancyEditor = document.createElement("div");
let header = document.querySelector("header");
const headerHeight = header.clientHeight;

console.log(`height: calc(100vh - ${headerHeight})`);
fancyEditor.style = `position: fixed; width: 400px; height: calc(100vh - ${headerHeight}px); right: 400px; top: ${headerHeight}px; font-size: 16px; display: flex; flex-direction: column`;

const updateButtonHtml = `
  <button 
      id="sketch-update-button"
      style=${`
        width: 100%;
        text-align: center;
        height: 2rem;
        color: white;
        text-transform: uppercase;
        font-weight: bold;
        background: rgb(101, 101, 101)
      `}
  >
    Update-us
  </button>
`;

const hideButtonHtml = `
  <button
    id="sketch-hide-editor-button"
      style="
        position: absolute;
        right: 0;
        z-index: 4;
        border-radius: 10px 0 0 10px;
        border: none;
        padding: 10px;
        top: 10px;
        text-align: center;
        height: 2rem;
        color: white;
        text-transform: uppercase;
        font-weight: bold;
        background: rgb(101, 101, 101);
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

function updateXstateEditor() {
  const inputStr = editor.getValue();

  console.log({ inputStr });
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
    xstateEditor.setValue(outputText);

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
  console.log("hi");
  if (fancyEditor.clientWidth < 50) {
    fancyEditor.style.width = "600px";
  } else {
    fancyEditor.style.width = "40px";
  }
}

const sketchHideEditorButton = document.getElementById(
  "sketch-hide-editor-button"
);

sketchHideEditorButton.addEventListener("click", toggleEditorVisibility);
