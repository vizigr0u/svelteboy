# SvelteBoy
A gameboy emulator and debugger written in AssemblyScript and Svelte

Try it on my [github page](https://vizigr0u.github.io/svelteboy/)

Frontend in [Vite](https://vitejs.dev/)+[Svelte](https://svelte.dev/) - backend in [AssemblyScript](https://www.assemblyscript.org)

![Capture as of 2023-09-01](https://github.com/vizigr0u/svelteboy/assets/1981001/dba8aead-0ec1-4117-9bfd-aa19c63f18e0)


## Status and scope

This is a gameboy emulator (DMG, the old bulky black and white one).

### Long term goal

being able to run at least one of these : Tetris, Pokemon Red.

### Features

A debugger that is good enough for me to dev and compare with good emulators.

## Installing

```
git clone git@github.com:vizigr0u/svelteboy.git
cd svelteboy
npm install
```

## Running the web version

`npm run asbuild:release` - builds the backend

`npm run dev` - runs the svelte frontend in dev mode

## Running the tests

`npm test` - runs some tests

## Project structure:

`assembly/`: The emulator written in AssemblyScript.
Also contains a Gameboy disassembler and some tests.

`dist/`: Svelte frontend build

`build/`: Where the backend gets built in WebAssembly

`src/`: Svelte frontend source

`tests/`: node side of the tests, whats get ran by `npm test`

`tools/runrom`: cli tool to run the emulator
