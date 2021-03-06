1. [ ] Add a way to add activities to state
2. [ ] Don't know if states have a `name` property. But all states can have an
   id. We can change the `name` property to `id` for all states.
3. Is it better to colocate the rust parser with the chrome extension and then
   move it out if it makes sense? Let's keep it separate until we get the parser
   to work.
4. [x] NEXT Copy other tokenizer tests from the JS version
5. [x] Figure out how to share the input string between different test functions
6. Rust tip: If you want  to run your tests in watch mode using `cargo watch`
   and also be able to print to console in tests - 
   `cargo watch “test -- --nocapture”`
7.  Instead of having a Token type with line and col, maybe it's better to rename
 TokenType to Token, convert the lexer to an iterator where the parser keeps
 asking for the next token. And when the parser needs it, most probably during
 an error, the parser can ask the lexer for the current line and column
 It will also make our lexer more performant because it will not go through 
 the whole text and get all tokens. It will do so lazily. In most cases when 
 there's an error in the initial parts of the string or in the middle, it 
 won't waste time parsing the rest of the string.
8. Figured out that using tokens as iterator will make it very hard to implement
   backtracking. And not having it as iterator will make it very hard to get the
   line and column number of a token. Will have to go back to adding line and
   column information in the token itself.
9. [x] Only thing left is to get hold of initial state for state with sub states.
10. [ ] Work on error handling for syntax errors and semantic. Try showing
    relevant and pin pointed errors.
11. Problem - I want to send my StateNode ast to Javascript caller across the
    wasm boundary as a JSON.
      Solution - 
        Add these dependencies - `serde`, `serde_derive` to cargo.toml
        Add this to the main file (lib.rs in our case)
          [#macro_use]
          extern crate serde_derive;
        Add `[#derive(Serialize, Deserialize)]` to the type we want to
        serialize. We also need to add the annotation to all the types which the
        main type uses so that everything is serializable.
        Call `JsValue::from_serde(&stateNode).unwrap()`, once we have generated 
        the StateNode AST from the string.
        IMP: Add `serde-serialize` as features to wasm_bindgen dependencies in
        cargo.toml file. When we add the features like that, we have to remove
        wasm-bindgen from dependencies list. This is another way to specify a
        dependency with additional data passed while installing the dependency.
        ```
        [dependencies.wasm-bindgen]
        version = "^0.2"
        features = ["serde-serialize"]
        ```

        OR

        use `serde-wasm-bindgen` - https://github.com/cloudflare/serde-wasm-bindgen
