import { parse } from "./parser/parser";
const MIN_WIDTH = 200;
const MAX_WIDTH = 1000;
let EDITOR_WIDTH = 400;

function styleMap(styles) {
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join(";");
}

// children always needs to be an array
function addChildrenToElement(el, children) {
  if (children && children.length > 0) {
    children.forEach(child => {
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });
  }
}

export function Element(elName, attributes, children) {
  const el = document.createElement(elName);

  Object.keys(attributes).forEach(attr => {
    el[attr] = attributes[attr];
  });

  // style attributes needs to be merged with
  // default button styles
  el.style = styleMap(attributes.style);

  addChildrenToElement(el, children);

  return el;
}

export function div(attributes, children) {
  return Element("div", attributes, children);
}

export function Button(attributes, children) {
  const buttonStyle = {
    width: "100%",
    "text-align": "center",
    color: "white",
    "text-transform": "uppercase",
    "font-weight": "bold",
    background: "rgb(101, 101, 101)",
    border: "none",
    cursor: "pointer",
    padding: "5px 10px",
    ...attributes.style
  };

  return Element("button", { ...attributes, style: buttonStyle }, children);
}

const errorPaneId = "sketch-systems-error-pane";
function clearErrorPane() {
  const errorPane = document.getElementById(errorPaneId);

  errorPane.innerHTML = "";
}

const successPaneId = "sketch-systems-success-message";
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

function Input(props, children) {
  return Element("input", props, children);
}

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
