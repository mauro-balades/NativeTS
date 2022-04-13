# NativeTS

A modern Typescript transpiler to llvm

## Installation

```
npm i -g native-ts
```

## Help

to get help on how to compile your typescript code, just run the following command:

```
native-ts --help
```

## How does it work

This program converts typescript code into native binary code or into llvm code.

### Example

typescript code:
```ts

class Hello {
    constructor() {}

    sayHi() {
        console.log("Hi!")
    }
}

var hello = new Hello()
hello.sayHi()

```

llvm IR:
```llvm
; ModuleID = 'main'
source_filename = "main"

%Hello = type {}
%string = type { i8*, i32 }

@0 = private unnamed_addr constant [4 x i8] c"Hi!\00", align 1

declare i32 @main()

define i32 @main.1() {
entry:
  %0 = call %Hello* @Hello__constructor()
  %hello = alloca %Hello*
  store %Hello* %0, %Hello** %hello
  %hello.load = load %Hello*, %Hello** %hello
  call void @Hello__sayHi(%Hello* %hello.load)
  ret i32 0
}

define %Hello* @Hello__constructor() {
entry:
  %0 = call i8* @gc__allocate(i32 0)
  %1 = bitcast i8* %0 to %Hello*
  ret %Hello* %1
}

declare i8* @gc__allocate(i32)

define void @Hello__sayHi(%Hello* %this) {
entry:
  call void @console__log(%string { i8* getelementptr inbounds ([4 x i8], [4 x i8]* @0, i32 0, i32 0), i32 3 })
  ret void
}

declare void @console__log(%string)
```

## References

This are the sources to make this project exis.

-   [LLVM language reference](https://releases.llvm.org/11.0.0/docs/LangRef.html)
-   [TypeScript Abstract Syntax Tree viewer](https://ts-ast-viewer.com/#code/FDI)
-   [TypeScript's language specifications](https://github.com/microsoft/TypeScript/blob/d8e830d132a464ec63fd122ec50b1bb1781d16b7/doc/spec-ARCHIVED.md)
