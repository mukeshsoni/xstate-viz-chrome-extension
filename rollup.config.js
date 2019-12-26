import resolve from "rollup-plugin-node-resolve";
import commonJS from "rollup-plugin-commonjs";
import builtins from "rollup-plugin-node-builtins";

const config = {
  input: "content.js",
  output: {
    file: "dist/content.js",
    format: "umd",
    name: "SketchSystemsParser"
  },
  plugins: [
    resolve(),
    commonJS({
      include: "node_modules/**"
    }),
    builtins()
  ]
};

export default config;
