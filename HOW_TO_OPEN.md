# How to build and open the Loom front end

Building means putting the code together into a program you can run.
Opening means starting that program. You need to build before you can open,
and you need to build again after changing the code.

All commands below are typed in a terminal (a window where you type commands),
from inside the app folder:

```
cd /home/ed/.loom/app
```

## Build it (only build, do not open)

```
cargo build
```

This reads `Cargo.toml` (the list of what the program needs) and `src/main.rs`
(the code), and puts the finished program here:

```
target/debug/loom-frontend
```

If nothing changed since the last build, this finishes in a second or two.
If it shows an error, the program was not built — read the first error line,
fix that place in the code, and run `cargo build` again.

For a faster, tidier final version, use `cargo build --release` instead.
That one lands in `target/release/loom-frontend`, and takes longer the first time.

## Open it (after building)

```
./target/debug/loom-frontend
```

## Build and open in one go (easiest)

```
./run.sh
```

This runs `cargo build` first — so it always picks up code changes — and
then opens the program. Or let Cargo do both steps itself:

```
cargo run
```

## If it does not work

- Make sure you are in `/home/ed/.loom/app` — `run.sh`, `Cargo.toml` and
  `src/main.rs` all live there. Building from the folder above fails with
  "could not find Cargo.toml".
- If you see "Permission denied" for the launcher, run this once, then try again:

```
chmod +x run.sh
```

- If you see "cargo: command not found", Rust is not installed yet. Install it
  from https://rustup.rs, close and reopen the terminal, then try again.
- The front end opens on its own. The Loom server is optional: you can browse
  agents and patterns without it, but Chat needs the server running (it is set
  to `http://localhost:5006` at the top of the window).
