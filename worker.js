import * as Comlink from "comlink";
import { parse } from "./parser/parser";

console.log("heyy");

Comlink.expose(parse);
