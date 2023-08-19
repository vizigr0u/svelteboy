# svelteboy
A gameboy emulator in AssemblyScript with a Svelte front-end

Frontend in [Vite](https://vitejs.dev/)+[Svelte](https://svelte.dev/) - backend in [AssemblyScript](https://www.assemblyscript.org)

!(Screenshot as of 2023-08-19 - e1df429)[Screenshot 2023-08-19 005928.png]

## Status and scope

This is a gameboy emulator (DMG, the old bulky black and white one).

### Long term goal

being able to run at least one of these : Tetris, Pokemon Red.

First up to the title screen, then maybe play if the performance is not too bad.

Let's be realistic: it will probably never work completely.

### Features

A debugger that is good enough for me to dev and compare with good emulators.

### Hosting

As long as this is too unstable and can't even display a game main title, I don't plan on hosting this to github pages.

Maybe I'll eventually add screen captures here.

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
