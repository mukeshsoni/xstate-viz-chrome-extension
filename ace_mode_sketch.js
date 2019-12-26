import ace from "brace";

// because we use brace, we have to use ace.define instead of the global define
// Also, the argument passed is named acequire instead of require. Don't know
// how the naming matters
// Some details here - https://gist.github.com/JackuB/3d589bd64dc96c1b18486baaaf58d910
ace.define(
  "ace/mode/sketch",
  [
    "require",
    "exports",
    "ace/lib/oops",
    "ace/mode/text",
    "ace/mode/custom_highlight_rules"
  ],
  (acequire, exports) => {
    const oop = acequire("ace/lib/oop");
    const TextMode = acequire("ace/mode/text").Mode;
    const CustomHighlightRules = acequire("ace/mode/custom_highlight_rules")
      .CustomHighlightRules;

    let Mode = function() {
      this.HighlightRules = CustomHighlightRules;
    };

    oop.inherits(Mode, TextMode); // ACE's way of doing inheritance

    exports.Mode = Mode; // eslint-disable-line no-param-reassign
  }
);

// This is where we really create the highlighting rules
ace.define(
  "ace/mode/custom_highlight_rules",
  ["require", "exports", "ace/lib/oop", "ace/mode/text_highlight_rules"],
  (acequire, exports) => {
    const oop = acequire("ace/lib/oop");
    const TextHighlightRules = acequire("ace/mode/text_highlight_rules")
      .TextHighlightRules;

    const CustomHighlightRules = function CustomHighlightRules() {
      this.$rules = {
        start: [
          {
            token: "empty_line",
            regex: "^$"
          },
          {
            token: "comment",
            regex: /%.*$/
          },
          {
            token: "keyword.operator",
            regex: /->/
          },
          // TODO: Add a rule for transition and then an embedded rule which
          // takes care of tokens inside the transition line. That way we can
          // highlight a transition name differently from the state name.
          // TODO: It will also help us highlight the condition name in a
          // different way
          // We can validate the headers with regex
          {
            // ace has predefined css for ace_entity.ace_name.ace_function
            // selector. We can probably add ace_state and then set the
            // token as entity.name.state
            token: "entity.name.function",
            regex: /[a-zA-Z0-9_]+/
          },
          {
            defaultToken: "text"
          }
        ]
      };
    };

    oop.inherits(CustomHighlightRules, TextHighlightRules);

    exports.CustomHighlightRules = CustomHighlightRules;
  }
);
