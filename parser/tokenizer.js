function last(arr) {
  return arr[arr.length - 1];
}

function prevTokenTypeCheck(tokens, type) {
  return tokens.length > 0 && tokens[tokens.length - 1].type === type;
}

export function tokenize(str) {
  let index = 0;
  let tokens = [];
  let indentStack = [0];
  let currentLine = 1;
  let currentCol = 1;
  const identifierRegex = /[a-zA-Z0-9_\.]/;

  function identifierToken() {
    let char = next();
    let idStr = '';

    while (char !== undefined && identifierRegex.test(char)) {
      idStr += char;
      index += 1;
      char = next();
    }

    return idStr;
  }

  function commentToken() {
    let char = next();
    let comment = '';

    while (char !== undefined && char !== '\n' && char !== '\r') {
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
    let wsCount = 0;

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
    } else if (char === '#') {
      const comment = commentToken();
      addToken('COMMENT', comment);
    } else if (char === '&') {
      addToken('PARALLEL_STATE');
      index += 1;
    } else if (char === '$') {
      addToken('FINAL_STATE');
      index += 1;
    } else if (char === '*') {
      addToken('INITIAL_STATE');
      index += 1;
    } else if (char === ';') {
      // we expect a condition after the semicolon
      const conditionName = conditionToken();
      addToken('CONDITION', conditionName);
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

