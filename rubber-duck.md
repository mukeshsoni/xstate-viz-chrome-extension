1. [ ] Add a keyboard shortcut or/and link to open a modal with complete
   desription of the language.
2. [ ] Try loading the parser in the web worker again, now that we have wasm
   working in our extension.
3. [x] Convert the state type names to names accepted by xstate. ParallelState
   to 'parallel' and so on. 
    Solution - Implement Serialize trait from serde for the StateType enum
4. [x] Also the property name has to be `type` and not
   `typ`. We have it as `typ` right now because `type` is a keyword in rust and
   cannot be used as a property name.
    Solution - Use `#[serde(rename(serialize = "type"))]` annotation above the
    `typ` property declaration in the StateNode struct.
5. [ ] Take care of error messages
6. Use production builds for both content.js and rust wasm code before
   publishing to chrome store
7. [ ] Publish to chrome store
8. [ ] NEXT Catch errors thrown by xstate and show them. Specially useful if the
   xstate pane is hidden.
   Might be able to catch them by monkey patching `console.error`
9. Try to feed ace the grammar for our language and see if we can show the
   warnings/errors on the side pane of the editor.
10. Ace is not recognizing spread operator in our javascript pane and shows them
    as errors.
11. We can also think about writing a reverse parser. It will take the xstate
    json state machine and spit out our simple text based representation. Might
    be helpful when someone opens this extension on a xstate.js.org/viz page
    which already has an existing machine.
12. Add a button which generates code for xstate/test based model based tests.
    Can generate code for testing-library or cypress
13. The main reason we are injecting a script and not just using content-script
    is because injected scripts have access to window object. See this article - 
    https://medium.com/p/9ae278e2bdf8/responses/show
    Why do we need the window object? I only saw it used in 2 places in our code. 
    Let's see if we can change our script to normal content script. Then we can 
    use the rust library which takes care of everything regarding wasm. We might 
    also try out running rust code in web worker. 
