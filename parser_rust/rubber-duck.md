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
9. [ ] Only thing left is to get hold of initial state for state with sub states.
10. [ ] Work on error handling for syntax errors and semantic. Try showing
    relevant and pin pointed errors.
