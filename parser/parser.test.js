import { tokenize } from "./tokenizer";
import { parse } from "./parser";

const inputStr = `abc
% some comment
  def -> lmn
  pasta -> noodles %more comment
  ast&*
    opq -> rst; ifyes
    uvw -> #abc.lastState
    nestedstate1
    nestedstate2*
  tried -> that > andDoThis
  lastState
    % trying out transient state
    -> ast; ifyes
    -> lastState; ifno`;

const expectedXstateJSON = {
  id: "abc",
  initial: "ast",
  on: {
    def: "lmn",
    pasta: "noodles",
    tried: {
      target: "that",
      actions: ["andDoThis"]
    }
  },
  states: {
    ast: {
      type: "parallel",
      initial: "nestedstate2",
      isInitial: true,
      on: {
        opq: { target: "rst", cond: "ifyes" },
        uvw: "#abc.lastState"
      },
      states: {
        nestedstate1: {},
        nestedstate2: { isInitial: true }
      }
    },
    lastState: {
      on: {
        "": [
          {
            target: "ast",
            cond: "ifyes"
          },
          {
            target: "lastState",
            cond: "ifno"
          }
        ]
      }
    }
  }
};

const invalidInputStr = `abc
  def -> lmn
      pqr
    stm`;

const fetchInputStr = `fetch
  idle
      FETCH -> loading
  loading
      RESOLVE -> success
      REJECT -> failure
  success$
  failure
      RETRY -> loading`;

const expectedXstateJSONFetch = {
  id: "fetch",
  initial: "idle",
  states: {
    idle: {
      on: {
        FETCH: "loading"
      }
    },
    loading: {
      on: {
        RESOLVE: "success",
        REJECT: "failure"
      }
    },
    success: {
      type: "final"
    },
    failure: {
      on: {
        RETRY: "loading"
      }
    }
  }
};
describe("tokenizer", () => {
  it("should give the correct number of tokens", () => {
    const tokens = tokenize(inputStr);

    console.log(tokens);
    expect(tokens).toHaveLength(53);
  });

  it("gives correct indent and dedent tokens", () => {
    const tokens = tokenize(inputStr);

    expect(tokens[2].type).toEqual("COMMENT");
    expect(tokens[4].type).toEqual("INDENT");
    expect(tokens[18].type).toEqual("INDENT");
    expect(tokens[33].type).toEqual("DEDENT");
  });

  it("catches incorrect indentation errors", () => {
    expect(() => tokenize(invalidInputStr)).toThrowError("Invalid indentation");
  });

  it("should have line and column number for tokens", () => {
    const tokens = tokenize(inputStr);

    const secondIdentifier = tokens[5];

    expect(secondIdentifier.type).toEqual("IDENTIFIER");
    expect(secondIdentifier.line).toEqual(3);
    expect(secondIdentifier.col).toEqual(3);

    const lastToken = tokens[tokens.length - 1];
    expect(lastToken.type).toEqual("DEDENT");

    const thirdLastToken = tokens[tokens.length - 4];

    expect(thirdLastToken.type).toEqual("IDENTIFIER");
    expect(thirdLastToken.line).toEqual(14);
    expect(thirdLastToken.col).toEqual(6);

    const uvwToken = tokens.find(token => token.text === "uvw");

    expect(uvwToken.type).toEqual("IDENTIFIER");
    expect(uvwToken.line).toEqual(7);
    expect(uvwToken.col).toEqual(5);
  });

  it("should have dedent after nestedstate2", () => {
    const tokens = tokenize(inputStr);

    const nestedstate2TokenIndex = tokens.findIndex(
      t => t.type === "IDENTIFIER" && t.text === "nestedstate2"
    );

    expect(tokens[nestedstate2TokenIndex + 3].type).toEqual("DEDENT");
  });
});

describe("parser", () => {
  it("should generate xstate representation of the input string", () => {
    const ast = parse(inputStr);

    // console.log(JSON.stringify(ast, null, 2));
    expect(ast).toEqual(expectedXstateJSON);
  });

  it("should generate xstate representation for the fetch statechart", () => {
    const ast = parse(fetchInputStr);

    // console.log(JSON.stringify(ast, null, 2));
    expect(ast).toEqual(expectedXstateJSONFetch);
  });

  it("should throw error when transition state not specified", () => {
    // TODO: Without the newline check in the parser
    // the below text is syntatically correct :(
    const inputStr = `abc
  def
    lmn ->
    -> lrt`;

    // TODO: The below string is also accepted with current grammar
    // This is because the rule
    // oneOrAnother(stateWithMoreDetails, stateWithNameOnly);
    // is also not correct. If a statename is followed by an indent, it should
    // try to resolve a stateWithMoreDetails. Not backtrack and try state
    // with name only
    // const inputStr = `abc
    // def
    // lmn ->
    // -> lrt`;
    const ast = parse(inputStr);

    console.log(ast.error.message, "\n", ast.error.token);
    console.log(JSON.stringify(ast, null, 2));
    expect(ast.error).toBeDefined();
  });
});

// tests cases when the parser finds and error in the input
// We want to give errors as accurate as possible
// And even helpful, if possible
describe("parser error handling", () => {});
