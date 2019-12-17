(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.SketchSystemsParser = {}));
}(this, (function (exports) { 'use strict';

  function last(arr) {
    return arr[arr.length - 1];
  }

  function prevTokenTypeCheck(tokens, type) {
    return tokens.length > 0 && tokens[tokens.length - 1].type === type;
  }

  function tokenize(str) {
    let index = 0;
    let tokens = [];
    let indentStack = [0];
    let currentLine = 1;
    let currentCol = 1;
    const identifierRegex = /[#a-zA-Z0-9_\.]/;

    function identifierToken() {
      let char = next();
      let idStr = "";

      while (char !== undefined && identifierRegex.test(char)) {
        idStr += char;
        index += 1;
        char = next();
      }

      return idStr;
    }

    function commentToken() {
      let char = next();
      let comment = "";

      while (char !== undefined && char !== "\n" && char !== "\r") {
        comment += char;
        index += 1;
        char = next();
      }

      return comment;
    }

    function conditionToken() {
      let char = next();

      while (!identifierRegex.test(char)) {
        index += 1;
        char = next();
      }

      return identifierToken();
    }

    // this is the main function
    // It takes care of creating the right INDENT and DETENT tokens
    // the algorithm is taken from here - https://docs.python.org/3/reference/lexical_analysis.html
    // the implementation is mostly copied from the chevrotain example here - https://github.com/SAP/chevrotain/blob/master/examples/lexer/python_indentation/python_indentation.js
    function whitespaceTokenizer() {
      // the y ensures that this regex only matches the beginning of the string
      const regex = / +/y;
      let char = next();

      // only checking for previous token as NEWLINE does not take
      // care of the first line
      if (prevTokenTypeCheck(tokens, "NEWLINE")) {
        const match = regex.exec(str.slice(index));
        let currentIndentLevel;
        if (match === null) {
          // this means that the new line does not have
          // any indentation. It's either empty or starts with a
          // non whitespace
          currentIndentLevel = 0;
        } else {
          currentIndentLevel = match[0].length;
        }

        const prevIndentLevel = last(indentStack);
        index += currentIndentLevel;
        currentCol = currentIndentLevel + 1;

        if (currentIndentLevel > prevIndentLevel) {
          indentStack.push(currentIndentLevel);
          return [
            {
              type: "INDENT",
              line: currentLine,
              col: 1,
              text: match[0]
            }
          ];
        } else if (currentIndentLevel < prevIndentLevel) {
          const dedentLevelInStack = indentStack.find(
            n => n === currentIndentLevel
          );

          // any dedent/outdent must match some previous indentation level.
          // otherwise it's a syntax error
          if (dedentLevelInStack === undefined) {
            throw new Error("Invalid indentation");
          }

          // keep popping indentation levels from indent dedentLevelInStack
          // until we reach the current indent level
          // push those many dedent tokens to tokenizer
          let indentLevelFromStack = last(indentStack);
          let dedentTokens = [];

          while (
            currentIndentLevel !== indentLevelFromStack &&
            indentStack.length > 0
          ) {
            indentStack.pop();
            dedentTokens.push({
              type: "DEDENT",
              line: currentLine,
              text: match ? match[0] : "",
              col: 1
            });

            indentLevelFromStack = last(indentStack);
          }

          return dedentTokens;
        } else {
          // same indentation level. do nothing. just consume it.
          return [];
        }
      } else {
        // TODO - should we separate this out into a whitespace tokenizer
        // and call this one indentDedentTokenizer?
        while (next() && /\t| /.test(next())) {
          index += 1;
        }

        return [];
      }
    }

    // return the next character in the stream
    function next() {
      return str[index];
    }

    function peek() {
      return str[index + 1];
    }

    function addToken(type, text) {
      tokens.push({
        type,
        text,
        line: currentLine,
        col: currentCol
      });

      currentCol += text ? text.length : 1;
    }

    while (index < str.length) {
      // after every round, let's just check if we need to
      // insert indent/dedent tokens
      tokens = tokens.concat(whitespaceTokenizer());
      const char = next();
      if (char === "\n") {
        addToken("NEWLINE");
        currentLine += 1;
        currentCol = 1;
        index += 1;
      } else if (char === "%") {
        const comment = commentToken();
        addToken("COMMENT", comment);
      } else if (char === "&") {
        addToken("PARALLEL_STATE");
        index += 1;
      } else if (char === "$") {
        addToken("FINAL_STATE");
        index += 1;
      } else if (char === "*") {
        addToken("INITIAL_STATE");
        index += 1;
      } else if (char === ";") {
        // we expect a condition after the semicolon
        const conditionName = conditionToken();
        addToken("CONDITION", conditionName);
      } else if (identifierRegex.test(char)) {
        const id = identifierToken();
        addToken("IDENTIFIER", id);
        // TODO: this check will not work when a dedent removes all
        // whitespace from a line. i.e. a line starts from the beginning
        // of the line
      } else if (char === " " || char === "\t") {
        const wsTokens = whitespaceTokenizer();
        tokens = tokens.concat(wsTokens);
      } else if (char === "-" && peek() === ">") {
        addToken("TRANSITION_ARROW");

        index += 2;
      } else {
        addToken("UNKNOWN", char);
        index += 1;
      }
    }

    // TODO - at the end of the tokenizing we need to pop out all remaining
    // indents from stack and push DEDENT tokens to our tokens list
    while (indentStack.length > 1 && indentStack.pop() > 0) {
      tokens.push({ type: "DEDENT", line: currentLine, col: currentCol });
    }
    return tokens;
  }

  // TODO: What if instead of throwing exceptions, each of the parsers returned
  // a Result type. The result type will encapsulate the possibility of failure

  // omit certain properties from an Object
  // the keys arguments contains array of strings which are
  // the array of property names to be omitted
  function omit(keys, obj) {
    return Object.entries(obj)
      .filter(([k, _]) => !keys.includes(k))
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  }

  // merges array of objects into a single object
  function arrayOfObjToObj(arr) {
    return arr.reduce((acc, item) => {
      // in case of transient states, we will have { '': { target: 'abc', cond: xyz } } kind of transitions. And they need to be merged for all '' appearances
      // They need to be merged into an array
      if (Object.keys(item).includes("")) {
        return {
          ...acc,
          "": acc[""] ? acc[""].concat(item[""]) : [item[""]]
        };
      } else {
        return { ...acc, ...item };
      }
    }, {});
  }

  function withInitialState(stateInfo) {
    const stateName = Object.keys(stateInfo)[0];
    const nestedStates = stateInfo[stateName].states;
    const nestedStateNames = Object.keys(nestedStates || {});

    if (nestedStateNames && nestedStateNames.length > 0) {
      const initialStateName = Object.entries(nestedStates).reduce(
        (acc, [k, v]) => {
          if (v.isInitial) {
            return k;
          } else {
            return acc;
          }
        },
        nestedStateNames[0]
      );

      return {
        ...stateInfo,
        [stateName]: {
          ...stateInfo[stateName],
          initial: initialStateName
        }
      };
    } else {
      return stateInfo;
    }
  }

  class ParserError extends Error {
    constructor(token, ...params) {
      super(...params);

      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, ParserError);
      }

      this.token = token;
    }
  }

  // the main function. Just call this with the tokens
  function parse(inputStr) {
    const tokensToIgnore = ["COMMENT", "NEWLINE", "WS"];
    // 1. filter the comment tokens. Not useful for the parsing
    // 2. We can also treat newlines as useless. They were only useful during
    // the tokenizing phase because the INDENT and DEDENT tokens have be to be
    // preceded by a NEWLINE. In the final grammar, newlines only complicate things
    const tokens = tokenize(inputStr).filter(
      t => !tokensToIgnore.includes(t.type)
    );
    let index = 0;

    const consume = () => tokens[index++];

    // implements grammar rule with possibilities
    // using backtracking
    // e.g. operator -> '+' | '-' | '*' | '/'
    function oneOrAnother(...args) {
      const savedIndex = index;

      for (let i = 0; i < args.length; i++) {
        const parser = args[i];
        try {
          const parserResult = parser();
          return parserResult;
        } catch (e) {
          // else reset index
          index = savedIndex;
        }
      }

      // if none of the parsers worked
      throw new ParserError(
        tokens[index],
        `oneOrAnother parser: matched none of the rules: ${args
        .map(fn => fn.name)
        .join(" | ")}`
      );
    }

    function zeroOrOne(fn) {
      const savedIndex = index;

      try {
        const parserResult = fn();

        return [parserResult];
      } catch (e) {
        index = savedIndex;
        return [];
      }
    }

    // to implement things like statements = transitions * states*
    function zeroOrMore(fn) {
      const parserResults = [];

      while (true) {
        const savedIndex = index;

        try {
          const parserResult = fn();

          parserResults.push(parserResult);
        } catch (e) {
          index = savedIndex;
          return parserResults;
        }
      }
    }

    // for cases like A -> B+
    // where B can appear one or more times
    function oneOrMore(fn) {
      try {
        const parserResult = fn();

        return [parserResult].concat(zeroOrMore(fn));
      } catch (e) {
        return e;
      }
    }

    function identifier() {
      if (tokens[index].type === "IDENTIFIER") {
        return consume().text;
      }

      throw new ParserError(
        tokens[index],
        `Could not find IDENTIFIER. Instead found ${tokens[index]}`
      );
    }

    function condition() {
      if (tokens[index].type === "CONDITION") {
        return consume().text;
      }

      throw new ParserError(
        tokens[index],
        `Could not find CONDITION identifier. Instead found ${tokens[index]}`
      );
    }

    function parallelState() {
      if (consume().type === "PARALLEL_STATE") {
        return true;
      }

      throw new ParserError(tokens[index], "Expected PARALLEL_STATE");
    }

    function finalState() {
      if (consume().type === "FINAL_STATE") {
        return true;
      }

      throw new ParserError(tokens[index], "Expected PARALLEL_STATE");
    }

    function initialState() {
      if (consume().type === "INITIAL_STATE") {
        return true;
      }

      throw new ParserError(tokens[index], "Expected PARALLEL_STATE");
    }

    function indent() {
      if (consume().type === "INDENT") {
        return true;
      }

      throw new ParserError(tokens[index], "Expected indent");
    }

    function dedent() {
      if (consume().type === "DEDENT") {
        return true;
      }

      throw new ParserError(tokens[index], "Expected dedent");
    }

    function arrow() {
      if (consume().type === "TRANSITION_ARROW") {
        return true;
      }

      throw new ParserError(tokens[index], "expected arrow");
    }

    function transition() {
      // we might have arrow as start for transient states
      const eventName = zeroOrOne(identifier) || "";
      arrow();
      const stateName = identifier();
      let conditionName;

      if (eventName) {
        conditionName = zeroOrOne(condition);
      } else {
        // if the first event name was absent, the condition is mandatory
        conditionName = condition();
      }

      return {
        type: "transition",
        // TODO: What if we used the more verbose definition of each transition
        // from the parser. { x: { target: 'y', cond: 'abc' }}. If we want to do
        // any optimizations, like convert transitions without any conditions to
        // shorter form, like { x: 'y' }, it can be done later on in one fell
        // swoop
        [eventName]:
          conditionName.length > 0
            ? { target: stateName, cond: conditionName[0] }
            : stateName
      };
    }
    // like transitions, nested states etc.
    // e.g.
    // active
    //  click_checkbox -> active
    //  uncheck -> inactive
    function stateWithMoreDetails() {
      const stateName = identifier();
      const parallel = zeroOrOne(parallelState);
      const isFinal = zeroOrOne(finalState);
      const isInitial = zeroOrOne(initialState);
      const isIndentThere = zeroOrOne(indent);
      let transitionsAndStates = [];

      // if there is an indent after state name, it has to be state with
      // extra info
      if (isIndentThere.length > 0) {
        transitionsAndStates = oneOrMore(() => {
          return oneOrAnother(transition, stateParser);
        });

        // any rule which has an indent should be always accompanied by a closing
        // dedent. The indent and dedent have to match up, just like parentheses
        // in other languages.
        dedent();
      }

      const transitions = transitionsAndStates.filter(
        ts => ts.type === "transition"
      );
      const nestedStates = transitionsAndStates.filter(
        ts => ts.type !== "transition"
      );

      return {
        [stateName]: {
          type:
            parallel.length > 0
              ? "parallel"
              : isFinal.length > 0
              ? "final"
              : undefined,
          isInitial: isInitial.length > 0 ? true : undefined,
          on:
            transitions.length > 0
              ? omit(["type"], arrayOfObjToObj(transitions))
              : undefined,
          states:
            nestedStates.length > 0 ? arrayOfObjToObj(nestedStates) : undefined
        }
      };
    }

    function stateParser() {
      try {
        const stateInfo = stateWithMoreDetails();

        return withInitialState(stateInfo);
      } catch (e) {
        throw new ParserError(tokens[index], e);
      }
    }

    function stateMachine() {
      try {
        const parserOutput = stateParser();

        const id = Object.keys(parserOutput)[0];

        let initial = undefined;

        if (parserOutput[id].states) {
          initial = Object.keys(parserOutput[id].states)[0];
        }

        return {
          id,
          initial,
          ...parserOutput[id]
        };
      } catch (e) {
        return { error: e };
      }
    }

    return stateMachine();
  }

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

  function Element(elName, attributes, children) {
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

  function div(attributes, children) {
    return Element("div", attributes, children);
  }

  function Button(attributes, children) {
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

  function Input(props, children) {
    return Element("input", props, children);
  }

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

  function HideButton() {
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

  function TransformButton() {
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

  function Toolbar() {
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
        "flex-direction": "column",
        // hide the pane by default on page load
        visibility: "visible"
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

  document.addEventListener("toggleSketchPane", toggleEditorVisibility);

  exports.HideButton = HideButton;
  exports.Toolbar = Toolbar;
  exports.TransformButton = TransformButton;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
