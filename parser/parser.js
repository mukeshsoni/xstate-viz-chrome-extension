import { tokenize } from "./tokenizer";

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
export function parse(inputStr) {
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

  function actions() {
    if (tokens[index].type === "ACTIONS") {
      return consume().text;
    }

    throw new ParserError(
      tokens[index],
      `Could not find ACTIONS identifier. Instead found ${tokens[index]}`
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
    let actionNames;

    if (eventName) {
      conditionName = zeroOrOne(condition);
      actionNames = zeroOrMore(actions);
    } else {
      // if the first event name was absent, the condition is mandatory
      conditionName = condition();
      actionNames = zeroOrMore(actions);
    }

    return {
      type: "transition",
      // TODO: What if we used the more verbose definition of each transition
      // from the parser. { x: { target: 'y', cond: 'abc' }}. If we want to do
      // any optimizations, like convert transitions without any conditions to
      // shorter form, like { x: 'y' }, it can be done later on in one fell
      // swoop
      [eventName]:
        conditionName.length > 0 || actionNames.length > 0
          ? {
              target: stateName,
              cond: conditionName.length > 0 ? conditionName[0] : undefined,
              actions: actionNames.length > 0 ? actionNames : undefined
            }
          : stateName
    };
  }

  function stateWithNameOnly() {
    const stateName = identifier();
    const parallel = zeroOrOne(parallelState);
    const isFinal = zeroOrOne(finalState);
    const isInitial = zeroOrOne(initialState);

    return {
      [stateName]: {
        type:
          parallel.length > 0
            ? "parallel"
            : isFinal.length > 0
            ? "final"
            : undefined,
        isInitial: isInitial.length > 0 ? true : undefined
      }
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
