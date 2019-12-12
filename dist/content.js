(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
}((function () { 'use strict';

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

    function identifierToken() {
      let char = next();
      let idStr = '';

      while (char !== undefined && /[a-zA-Z0-9_]/.test(char)) {
        idStr += char;
        index += 1;
        char = next();
      }

      return idStr;
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
      if (prevTokenTypeCheck(tokens, 'NEWLINE')) {
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
              type: 'INDENT',
              line: currentLine,
              col: 1,
              text: match[0],
            },
          ];
        } else if (currentIndentLevel < prevIndentLevel) {
          const dedentLevelInStack = indentStack.find(
            n => n === currentIndentLevel,
          );

          // any dedent/outdent must match some previous indentation level.
          // otherwise it's a syntax error
          if (dedentLevelInStack === undefined) {
            console.error('invalid indentation', indentStack, currentIndentLevel);
            throw new Error('Invalid indentation');
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
              type: 'DEDENT',
              line: currentLine,
              text: match ? match[0] : '',
              col: 1,
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
        col: currentCol,
      });

      currentCol += text ? text.length : 1;
    }

    while (index < str.length) {
      // after every round, let's just check if we need to
      // insert indent/dedent tokens
      tokens = tokens.concat(whitespaceTokenizer());
      const char = next();
      if (char === '\n') {
        addToken('NEWLINE');
        currentLine += 1;
        currentCol = 1;
        index += 1;
      } else if (char === '&') {
        addToken('PARALLEL_STATE');
        index += 1;
      } else if (char === '$') {
        addToken('FINAL_STATE');
        index += 1;
      } else if (/[a-zA-Z0-9_]/.test(char)) {
        const id = identifierToken();
        addToken('IDENTIFIER', id);
        // TODO: this check will not work when a dedent removes all
        // whitespace from a line. i.e. a line starts from the beginning
        // of the line
      } else if (char === ' ' || char === '\t') {
        const wsTokens = whitespaceTokenizer();
        tokens = tokens.concat(wsTokens);
      } else if (char === '-' && peek() === '>') {
        addToken('TRANSITION_ARROW');

        index += 2;
      } else {
        addToken('UNKNOWN', char);
        index += 1;
      }
    }

    // TODO - at the end of the tokenizing we need to pop out all remaining
    // indents from stack and push DEDENT tokens to our tokens list
    while (indentStack.length > 1 && indentStack.pop() > 0) {
      tokens.push({ type: 'DEDENT', line: currentLine, col: currentCol });
    }
    return tokens;
  }

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
    return arr.reduce((acc, item) => ({ ...acc, ...item }), {});
  }

  // the main function. Just call this with the tokens
  function parse(inputStr) {
    const tokens = tokenize(inputStr);
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
      throw new Error(
        `oneOrAnother parser: matched none of the rules: ${args
        .map(fn => fn.name)
        .join(' | ')}`,
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

    function newline() {
      if (consume().type === 'NEWLINE') {
        return true;
      }

      throw new Error('Expected a NEWLINE');
    }

    function identifier() {
      if (tokens[index].type === 'IDENTIFIER') {
        return consume().text;
      }

      throw new Error('Could not find IDENTIFIER. Instead found', tokens[index]);
    }

    function parallelState() {
      if (consume().type === 'PARALLEL_STATE') {
        return true;
      }

      throw new Error('Expected PARALLEL_STATE');
    }

    function finalState() {
      if (consume().type === 'FINAL_STATE') {
        return true;
      }

      throw new Error('Expected PARALLEL_STATE');
    }

    function indent() {
      if (consume().type === 'INDENT') {
        return true;
      }

      throw new Error('Expected indent');
    }

    function dedent() {
      if (consume().type === 'DEDENT') {
        return true;
      }

      throw new Error('Expected dedent');
    }

    function whitespace() {
      if (consume().type === 'WS') {
        return true;
      }

      throw new Error('expected whitespace');
    }

    function arrow() {
      if (consume().type === 'TRANSITION_ARROW') {
        return true;
      }

      throw new Error('expected whitespace');
    }

    function transition() {
      const eventName = identifier();
      zeroOrMore(whitespace);
      arrow();
      zeroOrMore(whitespace);
      const stateName = identifier();
      zeroOrMore(newline);

      return {
        type: 'transition',
        [eventName]: stateName,
      };
    }

    function stateWithNameOnly() {
      const stateName = identifier();
      const parallel = zeroOrOne(parallelState);
      const isFinal = zeroOrOne(finalState);
      zeroOrMore(newline);

      return {
        [stateName]: {
          type:
            parallel.length > 0
              ? 'parallel'
              : isFinal.length > 0
              ? 'final'
              : undefined,
        },
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
      oneOrMore(newline);
      indent();
      const transitionsAndStates = zeroOrMore(() => {
        return oneOrAnother(transition, stateParser);
      });
      zeroOrOne(() => {
        return oneOrMore(newline());
      });
      zeroOrMore(newline);

      const transitions = transitionsAndStates.filter(
        ts => ts.type === 'transition',
      );
      const nestedStates = transitionsAndStates.filter(
        ts => ts.type !== 'transition',
      );

      return {
        [stateName]: {
          type:
            parallel.length > 0
              ? 'parallel'
              : isFinal.length > 0
              ? 'final'
              : undefined,
          on:
            transitions.length > 0
              ? omit(['type'], arrayOfObjToObj(transitions))
              : undefined,
          states:
            nestedStates.length > 0 ? arrayOfObjToObj(nestedStates) : undefined,
        },
      };
    }

    function stateParser() {
      try {
        const stateInfo = oneOrAnother(stateWithMoreDetails, stateWithNameOnly);
        zeroOrMore(dedent);
        // const stateInfo = stateWithMoreDetails();
        return stateInfo;
      } catch (e) {
        console.error(
          `Failed to parse: for token ${index}: \n`,
          tokens[index],
          '\nError: ',
          e.message,
        );
        throw new Error(e);
      }
    }

    function stateMachine() {
      try {
        const parserOutput = stateParser();

        const id = Object.keys(parserOutput)[0];
        const initial = Object.keys(parserOutput[id].states)[0];

        return {
          id,
          initial,
          ...parserOutput[id],
        };
      } catch (e) {
        return { error: e };
      }
    }

    return stateMachine();
  }

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

})));
