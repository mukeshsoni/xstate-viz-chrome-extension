import * as Comlink from "comlink";
import { parse } from "./parser/parser";
// import * as wasm from "./parser_rust/pkg/rust_parser_sketch_to_xstate";

// console.log("heyy", wasm.parse.toString());

Comlink.expose(parse);
