/*
MIT License

Copyright (c) 2022 Mauro Baladés

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import * as ts from "typescript";
import * as llvm from "llvm-node";

import { newLLVMFunction } from "./utils";

class Module {
    readonly program: ts.Program;
    context!: llvm.LLVMContext;
    module!: llvm.Module;

    // main function declarations
    mainFunc!: llvm.Function;
    mainRetT!: llvm.IntegerType;

    constructor(program: ts.Program) {
        this.program = program;
    }

    /// GET FUNCTIONS
    getTypeChecker() {
        return this.program.getTypeChecker();
    }

    getModule(): llvm.Module {
        return this.module;
    }

    getContext(): llvm.LLVMContext {
        return this.context;
    }

    /// SET FUNCTIONS
    setContext(): void {
        this.context = new llvm.LLVMContext();
    }

    setEntry(): void {
        llvm.BasicBlock.create(this.context, "entry", this.mainFunc);
    }

    setModule(name: string = "main"): void {
        this.module = new llvm.Module(name, this.context);
        this.setMainFunction();
    }

    setMainReturnType(): void {
        this.mainRetT = llvm.Type.getInt32Ty(this.context);
    }

    setMainFunction(name: string = "main"): void {
        this.setMainReturnType();
        this.mainFunc = newLLVMFunction(this.mainRetT, [], name, this.module);
    }
}

/// EXPORTS ///

export function createModule(
    program: ts.Program,
    name: string = "main"
): Module {
    let module = new Module(program);

    module.setContext();
    module.setModule();
    module.setMainFunction(name);
    module.setEntry();

    return module;
}

export { Module };
