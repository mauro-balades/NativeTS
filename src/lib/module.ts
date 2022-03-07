#!/usr/bin/env node
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

class Module {

    program: ts.Program;
    context!: llvm.LLVMContext;
    module!: llvm.Module;

    // main function declarations
    mainFunc!: any;
    mainRetT!: llvm.IntegerType;

    constructor(program: ts.Program) {
        this.program = program;
    }

    /// UTIL FUNCTIONS ///
    getTypeChecker() {
        return this.program.getTypeChecker();
    }

    /// SET FUNCTIONS ///

    setContext(): void {
        this.context = new llvm.LLVMContext();
    }

    setModule(name: string = "main"): void {
        this.module = new llvm.Module(name, this.context);
    }

    setMainReturnType(name: string = "main"): void {
        this.mainRetT = llvm.Type.getInt32Ty(this.context)
    }

    setMainFunction(name: string = "main"): void {
        this.setMainReturnType();
        this.mainFunc = undefined;
    }
}


/// EXPORTS ///

export function createModule(program: ts.Program): void {



}
