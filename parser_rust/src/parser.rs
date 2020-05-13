use serde::ser::{Serialize, Serializer};
use std::collections::HashMap;

mod tokenizer;
use tokenizer::*;

#[derive(Debug, PartialEq, Eq, Clone)]
enum StateType {
    AtomicState,
    CompoundState,
    FinalState,
    ParallelState,
}

// we want to convert the StateType to strings which xstate understands
// we do so by implementing the Serialize trait from serde
impl Serialize for StateType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(match *self {
            StateType::AtomicState => "atomic",
            StateType::CompoundState => "compound",
            StateType::FinalState => "final",
            StateType::ParallelState => "parallel",
        })
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize)]
pub struct TransitionNode<'a> {
    event: &'a str,
    target: &'a str,
    // Use a method to decide whether the field should be skipped.
    #[serde(skip_serializing_if = "Option::is_none")]
    cond: Option<&'a str>,
    // Use a method to decide whether the field should be skipped.
    #[serde(skip_serializing_if = "Option::is_none")]
    actions: Option<Vec<&'a str>>,
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize)]
pub struct StateNode<'a> {
    id: &'a str,
    // rust tip: We can't use the property name "type" because it's a rust
    // keyword. But we can rename the property when serializing with serde
    // using the below annotation
    #[serde(rename(serialize = "type"))]
    typ: StateType,
    // Use a method to decide whether the field should be skipped.
    #[serde(skip_serializing_if = "Option::is_none")]
    initial: Option<&'a str>,
    is_initial: bool,
    // xstate has a representation of events as
    // {
    // on: [
    // { event: eventName, target: targetName },
    // { event: eventName, target: targetName }
    // ]
    // }
    // If we stick to that one represention, it becomes easier to capture the
    // transient events too. We can have multiple items in the vector which
    // have event as empty string "". That is not possible if we convert the
    // events to HashMap
    // We can anyways convert the final json to various forms. E.g. we can
    // convert most events to { on: { 'click': 'go_to_state_1' }} form, because
    // that's what most people want. Or not.
    on: Vec<TransitionNode<'a>>,
    states: HashMap<&'a str, StateNode<'a>>,
}

#[derive(Debug, PartialEq, Eq, Clone)]
enum TransitionOrState<'a> {
    State(StateNode<'a>),
    Transition(TransitionNode<'a>),
}
// TODO: This return value is not enough. We need to consume the token, which
// means updating the offset. Each parser can change the offset by different
// amount. We can either return a tuple (new_offset, Option<&'a str>) or we
// can define these methods as Type methods for a Parser type.
// struct Parser<'a> {
//     offset: usize,
//     tokens: Vec<Token<'a>>,
//     input_str: &'a str,
// }
//
// impl Parser {
//   fn new(input_str: &str) {
//      Parser {
//          offset: 0,
//          input_str
//      }
//   }
//
//   fn parse(&self) {
//      let tokens = tokenize(self.input_str);
//
//      // if we store the token iterator then we won't have to store the offset
//      // at each stage. We also want the ability to peek into the tokens in
//      // case we want to backtrack.
//      self.tokens = tokens.iter();
//   }
//
//   fn condition(&self) {
//      if let TokenType::Condition(text) == self.tokens.peek() {
//          self.tokens.next();
//          Some(text)
//      }
//
//      None;
//   }
//
//   OR
//
//   // This one does not use the token iterator. Just uses offset to keep track
//   // of next token to consume. And consume updates the offset internally.
//   fn condition(&self) {
//      if let TokenType::Condition(text) == self.tokens[self.offset] {
//          self.consume();
//          Some(text)
//      }
//
//      None;
//   }
// }

// But the above will not help us with the offset, will it? How will a parser
// know when to stop peeking and start advancing the iterator? It might do so
// wrong and the whole chain becomes buggy from that point.
// What if each parser returns Option<(new_offset, ParserResult)>? Then each
// parser has the responsibility of adjusting the offset after calling other
// parsers internally. That's not good. Instead only the higher level parser
// combinators (like oneOrAnother or zero_or_more) should know about the
// concept of offset or index.
// Ok, so individual parsers just consume tokens if they see it fit to do so
// And only parser combinators worry about backtracking, which involves putting
// the offset/index back to some previous position.

pub struct Parser<'a> {
    tokens: Vec<Token<'a>>,
}

// looks like i can't write this method zero_or_one in rust
// It needs a mutable reference to it's self type. But the function it takes
// which parses the current token also needs mutable reference to self. That
// is not allowed in rust. 2 things can't have mutable reference to the same
// thing
// The only solution seems to be not to mutate offset but instead return
// new offset from each parser.
// The return type sends the offset as a return value in both success and fail
// case since both are actually success for zero_or_one. No match is also what
// this parser is supposed to treat as a success.
// TODO: Why can't it return Option<(offset, T)> like all other parsers do?
// Then we would also have a unified api for all parser functions.
fn zero_or_one<T, F>(offset: usize, f: F) -> (usize, Option<T>)
where
    F: Fn(usize) -> Option<(usize, T)>,
{
    if let Some(x) = f(offset) {
        let (new_offset, v) = x;
        return (new_offset, Some(v));
    }

    (offset, None)
}

// TODO: these parser combinators are not using self at all. We can move
// them out of the impl methods
fn zero_or_more<T, F>(offset: usize, mut f: F) -> (usize, Option<Vec<T>>)
where
    F: FnMut(usize) -> Option<(usize, T)>,
{
    let mut new_offset = offset;
    let mut parsed_values = vec![];

    while let Some(x) = f(new_offset) {
        let (newer_offset, v) = x;
        new_offset = newer_offset;
        parsed_values.push(v);
    }

    if parsed_values.len() > 0 {
        return (new_offset, Some(parsed_values));
    } else {
        return (offset, None);
    }
}

fn get_state_type(
    is_parallel_state: bool,
    is_final_state: bool,
    sub_states_count: usize,
) -> StateType {
    if is_parallel_state {
        return StateType::ParallelState;
    }

    if is_final_state {
        return StateType::FinalState;
    }

    if sub_states_count > 0 {
        return StateType::CompoundState;
    }

    return StateType::AtomicState;
}

fn get_initial_state<'a>(sub_states: &Vec<(&'a str, StateNode<'a>)>) -> Option<&'a str> {
    if sub_states.len() == 0 {
        return None;
    }

    if let Some((initial_sub_state, _)) = sub_states.iter().find(|(_, s)| s.is_initial == true) {
        return Some(initial_sub_state);
    } else {
        let (initial_sub_state, _) = sub_states[0];
        return Some(initial_sub_state);
    }
}

// all parsers return Option<(offset, returnValueForThatParser)>
// all parser combinators return (offset, Option<returnValueForParser or Vec<returnValueForParser>>)

impl<'a> Parser<'a> {
    // Question: Should the input str be sent when creating a new parser or
    // during the call to parse? If we send it during Parser creation, we have
    // to keep creating new parsers for every new parse.
    // If we send it during parse call, what is even the point of having a
    // new method? We can directly call Parser::parse(input_str). Also, we
    // won't have to store input_str in the struct any more. We need it to
    // only get the tokens. The problem is, these methods are defined on Parser
    // So we need an instance of Parser to call these methods. So either the
    // user has to create an instance of the Parser themselves, or we provide a
    // new method to do it for them
    // Sigh. Let's go ahead with passing input_str to parse as argument for now
    // At least we won't have to
    // 1. Store the input_str inside the parser
    // 2. Won't have to create a new instance of Parser for every new parse
    pub fn new() -> Parser<'a> {
        Parser { tokens: vec![] }
    }

    fn get_token_at(&self, offset: usize) -> Option<&Token<'a>> {
        if offset < self.tokens.len() {
            return Some(&self.tokens[offset]);
        }

        None
    }

    // This parser works for all parsers which want to compare token to
    // something and return T if the comparison is successful
    // It helps take care of some repeating things
    // 1. use get_token_at and pull value out of the Option returned by that method
    // 2. Wrap the values in Option enum
    fn match_parser<T, F, F2>(&self, offset: usize, pred: F, get_val: F2) -> Option<(usize, T)>
    where
        F: Fn(&Token<'a>) -> bool,
        F2: Fn(&Token<'a>) -> T,
    {
        if let Some(token) = self.get_token_at(offset) {
            // TODO: If i can change below if to `if let`, then i can pass
            // whatever was found inside the enum which was matched and pass
            // it on to get_val. Otherwise, get_val would again have to match
            // token.typ to enum and send back and Option
            // Maybe we can have get_val return an Option and always do
            // get_val(token).unwrap()
            if pred(token) {
                return Some((offset + 1, get_val(token)));
            }
        }

        None
    }

    fn identifier(&self, offset: usize) -> Option<(usize, &'a str)> {
        if let Some(token) = self.get_token_at(offset) {
            if let TokenType::Identifier(text) = token.typ {
                return Some((offset + 1, text));
            }
        }

        None
    }

    fn transition_arrow(&self, offset: usize) -> Option<(usize, bool)> {
        if let Some(token) = self.get_token_at(offset) {
            if let TokenType::TransitionArrow = token.typ {
                return Some((offset + 1, true));
            }
        }

        None
    }

    fn condition(&self, offset: usize) -> Option<(usize, &'a str)> {
        if let Some(token) = self.get_token_at(offset) {
            if let TokenType::Condition(cond_str) = token.typ {
                return Some((offset + 1, cond_str));
            }
        }

        None
    }

    fn action(&self, offset: usize) -> Option<(usize, &'a str)> {
        if let Some(token) = self.get_token_at(offset) {
            if let TokenType::Action(cond_str) = token.typ {
                return Some((offset + 1, cond_str));
            }
        }

        None
    }

    fn parallel_state(&self, offset: usize) -> Option<(usize, bool)> {
        self.match_parser(
            offset,
            |token| token.typ == TokenType::ParallelState,
            |_| true,
        )
    }

    fn final_state(&self, offset: usize) -> Option<(usize, bool)> {
        self.match_parser(offset, |token| token.typ == TokenType::FinalState, |_| true)
    }

    fn initial_state(&self, offset: usize) -> Option<(usize, bool)> {
        self.match_parser(
            offset,
            |token| token.typ == TokenType::InitialState,
            |_| true,
        )
    }

    fn indent(&self, offset: usize) -> Option<(usize, bool)> {
        self.match_parser(offset, |token| token.typ == TokenType::Indent, |_| true)
    }

    fn dedent(&self, offset: usize) -> Option<(usize, bool)> {
        self.match_parser(
            offset,
            |token: &Token<'a>| token.typ == TokenType::Dedent,
            |_| true,
        )
    }

    fn transition(&self, offset: usize) -> Option<(usize, TransitionNode<'a>)> {
        let new_offset;
        let (offset, event_option) = zero_or_one(offset, |offset| self.identifier(offset));
        let mut event = "";
        let (offset, _) = self.transition_arrow(offset)?;
        let (offset, target) = self.identifier(offset)?;

        let condition_name;
        let mut action_names = None;

        if let Some(en) = event_option {
            event = en;
            let (offset, cn) = zero_or_one(offset, |offset| self.condition(offset));
            condition_name = cn;
            let (offset, ans) = zero_or_more(offset, |offset| self.action(offset));
            action_names = ans;
            new_offset = offset;
        } else {
            // if the event name is not given, we definitely want the condition
            // It means it's a transient event and needs to be accompanied by
            // a condition
            let (offset, condition_name_str) = self.condition(offset)?;
            condition_name = Some(condition_name_str);
            let (offset, action_name_option) = zero_or_more(offset, |offset| self.action(offset));

            if let Some(action_name_strings) = action_name_option {
                action_names = Some(action_name_strings);
            }

            new_offset = offset;
        }

        let transition_node = TransitionNode {
            event,
            target,
            cond: condition_name,
            actions: action_names,
        };

        Some((new_offset, transition_node))
    }

    // All our parsers will return an Option. If parsing was successful, return
    // Some<SomeData> else return None. We can probably write generic functions
    // which can handle these Option<T> return values. Functions like zero_or_more
    // one_or_more etc.
    // We can use the question mark (?) operator
    // self.identifier()?;
    fn state_parser(&mut self, offset: usize) -> Option<(usize, StateNode<'a>)> {
        let (offset, id) = self.identifier(offset)?;
        let (offset, is_parallel_state_option) =
            zero_or_one(offset, |offset| self.parallel_state(offset));
        // rust tip: Super way to get a value out of an option if we don't care
        // about the absent value and have a default value as replacement.
        let is_parallel_state = is_parallel_state_option.unwrap_or(false);

        let (offset, is_final_state_option) = zero_or_one(offset, |o| self.final_state(o));
        let is_final_state = is_final_state_option.unwrap_or(false);

        let (offset, is_initial_state_option) = zero_or_one(offset, |o| self.initial_state(o));
        let is_initial_state = is_initial_state_option.unwrap_or(false);

        let (mut offset, is_indent_there_option) = zero_or_one(offset, |o| self.indent(o));
        let is_indent_there = is_indent_there_option.unwrap_or(false);
        let mut transitions: Vec<TransitionNode<'a>> = vec![];
        let mut sub_states: Vec<(&'a str, StateNode<'a>)> = vec![];

        if is_indent_there {
            // Had to create a separate enum to hold either TransitionNode or
            // StateNode. And then it became super painful to take them apart.
            let (new_offset, transitions_and_states_option) =
                zero_or_more(offset, |o| -> Option<(usize, TransitionOrState)> {
                    if let Some((no, x)) = self.transition(o) {
                        return Some((no, TransitionOrState::Transition(x)));
                    }

                    if let Some((no, x)) = self.state_parser(o) {
                        return Some((no, TransitionOrState::State(x)));
                    }

                    return None;
                });

            if let Some(transitions_and_states) = transitions_and_states_option {
                // Had to clone the list because otherwise rust complains that
                // the values are already moved when i try to get the states
                // in the second filter pass
                let transitions_and_states_clone = transitions_and_states.clone();
                transitions = transitions_and_states
                    .into_iter()
                    .filter_map(|ts| match ts {
                        // we can convert a vector to hashmap by having the vector as a
                        // vector of tuples of (key, val)
                        TransitionOrState::Transition(t) => Some(t),
                        _ => None,
                    })
                    .collect();
                sub_states = transitions_and_states_clone
                    .into_iter()
                    .filter_map(|ts| match ts {
                        TransitionOrState::State(t) => Some((t.id, t)),
                        _ => None,
                    })
                    .collect();
            }

            zero_or_more(new_offset, |o| self.dedent(o));
            offset = new_offset;

            let (new_offset, _) = zero_or_one(offset, |o| self.dedent(o));
            offset = new_offset;
        }

        Some((
            offset,
            StateNode {
                id,
                typ: get_state_type(is_parallel_state, is_final_state, sub_states.len()),
                initial: get_initial_state(&sub_states),
                is_initial: is_initial_state,
                // we can convert a vector to hashmap by having the vector as a
                // vector of tuples of (key, val)
                // TODO: Converting transitions vector to hashmap like this merges
                // transient transitions into a single one. Keeps the last one.
                // Because all the transient transitions have the same empty string
                // key
                on: transitions,
                states: sub_states.into_iter().collect(),
            },
        ))
    }

    // Our parser returns a Result type. Which means it returns an error if the
    // parsing fails.
    // TODO: Define a custom error struct
    pub fn parse(&mut self, input_str: &'a str) -> Result<StateNode<'a>, &'a str> {
        self.tokens = tokenize(input_str)
            .into_iter()
            // rust tip: If you want to match partially on a enum with a value
            // In this case i didn't care about what's inside Comment enum
            // variant
            .filter(|t| !matches!(t.typ, TokenType::Comment(_)))
            .collect();

        if let Some((_, ast)) = self.state_parser(0) {
            // println!("ast {:#?}", ast);
            return Ok(ast);
        }

        Err("MyParser: Error parsing string")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    static INPUT: &str = "abc
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
    -> lastState; ifno";

    #[test]
    fn test_parser() {
        let mut parser = Parser::new();
        let ast = parser.parse(INPUT).unwrap();

        let expected_ast: StateNode = StateNode {
            id: "abc",
            typ: StateType::CompoundState,
            initial: Some("ast"),
            is_initial: false,
            on: vec![
                TransitionNode {
                    event: "def",
                    target: "lmn",
                    cond: None,
                    actions: None,
                },
                TransitionNode {
                    event: "pasta",
                    target: "noodles",
                    cond: None,
                    actions: None,
                },
                TransitionNode {
                    event: "tried",
                    target: "that",
                    cond: None,
                    actions: Some(vec!["andDoThis"]),
                },
            ],
            states: vec![
                (
                    "lastState",
                    StateNode {
                        id: "lastState",
                        typ: StateType::AtomicState,
                        initial: None,
                        is_initial: false,
                        on: vec![
                            TransitionNode {
                                event: "",
                                target: "ast",
                                cond: Some("ifyes"),
                                actions: None,
                            },
                            TransitionNode {
                                event: "",
                                target: "lastState",
                                cond: Some("ifno"),
                                actions: None,
                            },
                        ],
                        states: HashMap::new(),
                    },
                ),
                (
                    "ast",
                    StateNode {
                        id: "ast",
                        typ: StateType::ParallelState,
                        initial: Some("nestedstate2"),
                        is_initial: true,
                        on: vec![
                            TransitionNode {
                                event: "opq",
                                target: "rst",
                                cond: Some("ifyes"),
                                actions: None,
                            },
                            TransitionNode {
                                event: "uvw",
                                target: "#abc.lastState",
                                cond: None,
                                actions: None,
                            },
                        ],
                        states: vec![
                            (
                                "nestedstate2",
                                StateNode {
                                    id: "nestedstate2",
                                    typ: StateType::AtomicState,
                                    initial: None,
                                    is_initial: true,
                                    on: vec![],
                                    states: HashMap::new(),
                                },
                            ),
                            (
                                "nestedstate1",
                                StateNode {
                                    id: "nestedstate1",
                                    typ: StateType::AtomicState,
                                    initial: None,
                                    is_initial: false,
                                    on: vec![],
                                    states: HashMap::new(),
                                },
                            ),
                        ]
                        .into_iter()
                        .collect(),
                    },
                ),
                (
                    "lastState",
                    StateNode {
                        id: "lastState",
                        typ: StateType::AtomicState,
                        initial: None,
                        is_initial: false,
                        on: vec![
                            TransitionNode {
                                event: "",
                                target: "ast",
                                cond: Some("ifyes"),
                                actions: None,
                            },
                            TransitionNode {
                                event: "",
                                target: "lastState",
                                cond: Some("ifno"),
                                actions: None,
                            },
                        ],
                        states: HashMap::new(),
                    },
                ),
            ]
            .into_iter()
            .collect(),
        };

        assert_eq!(expected_ast, ast);
    }
}
