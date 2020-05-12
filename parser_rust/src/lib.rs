mod parser;

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
pub fn greet(greeting: &str) {
    alert(
        format!(
            "Hello, rust-wasm! How are you today? {:?} {}",
            greeting,
            master_greeter()
        )
        .as_str(),
    );
}
