1. [ ] Add a keyboard shortcut or/and link to open a modal with complete
   desription of the language.
2. [ ] Try loading the parser in the web worker again, now that we have wasm
   working in our extension.
3. [ ] Convert the state type names to names accepted by xstate. ParallelState
   to 'parallel' and so on. Also the property name has to be `type` and not
   `typ`. We have it as `typ` right now because `type` is a keyword in rust and
   cannot be used as a property name.
4. [ ] Take care of error messages
