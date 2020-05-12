mod parser;

#[macro_use]
extern crate serde_derive;

use parser::*;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn parse(input: &str) -> JsValue {
    let mut parser = Parser::new();

    let ast = parser.parse(input);

    match ast {
        Ok(ast) => JsValue::from_serde(&ast).unwrap(),
        Err(error_str) => JsValue::from_serde(error_str).unwrap(),
    }
}
