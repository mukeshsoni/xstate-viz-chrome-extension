This module parses a textual indent based language to describe a statechart into
xstate json representation.

### Trying it out

To run the tests - 

```
cargo run test
```

if you have installed `cargo-watch`

```
cargo watch -x test
```

### Generate wasm files

```
wasm-pack build --target web
```

we don't use `wasm-pack build --target bundler` because that doesn't work for
our usecase of loading the wasm files in chrome extension.
