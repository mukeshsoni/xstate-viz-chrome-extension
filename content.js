import { parse } from "./parser/parser";

let fancyEditor = document.createElement("div");
let header = document.querySelector("header");
const headerHeight = header.clientHeight;
const MIN_WIDTH = 200;
const MAX_WIDTH = 1000;
let EDITOR_WIDTH = 400;

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

fancyEditor.style = `
  position: fixed;
  width: ${EDITOR_WIDTH}px;
  height: calc(100vh - ${headerHeight}px);
  right: ${getEditorRight()}px;
  top: ${headerHeight}px;
  font-size: 16px;
  display: flex;
  flex-direction: column`;

const buttonStyle = {
  width: "100%",
  "text-align": "center",
  color: "white",
  "text-transform": "uppercase",
  "font-weight": "bold",
  background: "rgb(101, 101, 101)",
  border: "none",
  cursor: "pointer",
  padding: "5px 10px"
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
        z-index: 4;
        border-radius: 10px;
        padding: 5px 10px;
        margin-left: 20px;
        border: 1px solid white;
      ">
    Hide
  </button>
`;

const headerHtml = `
  <header
    style="
      background: rgb(101, 101, 101);
      padding: 5px 10px;
      color: white;
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
    ">
    ${hideButtonHtml} 
    <label style="display: flex; border: 1px solid white; padding: 3px 10px;">
      width
      <input 
        id='sketch-systems-width-input'
        type='range'
        min='${MIN_WIDTH}'
        max='${MAX_WIDTH}'
        value='${EDITOR_WIDTH}'
        style="
          margin-left: 10px;
          width: 70px;
        "
      />
    </label>
  </header>
`;

fancyEditor.innerHTML = `
  ${headerHtml}
  <div id="sketch-systems-editor" style="flex: 1"></div>
  <div 
    id="sketch-systems-success-message"
    style="
      color: green;
      display: none;
      overflow-wrap: break-word;
    "
  >
    Transformed successfully!
  </div>
  <div 
    id="sketch-systems-error-pane"
    style="
      color: red;
    "
  >
  </div>
  <div style="width: 100%; padding: 10px; ">
    ${updateButtonHtml}
  </div>
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

function hideSuccessMessagePane() {
  const successMessagePane = document.getElementById(
    "sketch-systems-success-message"
  );

  successMessagePane.style.display = "none";
}

function showSuccessMessagePane() {
  const successMessagePane = document.getElementById(
    "sketch-systems-success-message"
  );

  successMessagePane.style.display = "block";
}

function showError(error) {
  hideSuccessMessagePane();
  const errorPane = document.getElementById("sketch-systems-error-pane");

  errorPane.innerHTML = `<div>${error.message}</div><div>Line no: ${error.token.line}, Column no: ${error.token.col}</div>`;
}

function clearErrorPane() {
  const errorPane = document.getElementById("sketch-systems-error-pane");

  errorPane.innerHTML = "";
}

function updateXstateEditor() {
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
    fancyEditor.style.width = `${EDITOR_WIDTH}px`;
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

editor.on("change", () => {
  saveToLocalStorage();
  hideSuccessMessagePane();
});

function adjustEditorPosition() {
  fancyEditor.style.right = `${getEditorRight()}px`;
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
    fancyEditor.style.width = `${EDITOR_WIDTH}px`;
  } else {
    console.log(`width has to be between ${MIN_WIDTH} and ${MAX_WIDTH} pixels`);
  }
});
