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

import { Module } from "./module";
import Enviroment from "./enviroment/enviroment";
import Emitter from "./emitter";

class LLVMGenerator {
    readonly checker: ts.TypeChecker;
    readonly module: llvm.Module;
    readonly context: llvm.LLVMContext;
    readonly builder: llvm.IRBuilder;
    readonly enviroment: Enviroment;
    readonly emitter: Emitter;

    constructor(module: Module) {
        this.checker = module.getTypeChecker();
        this.module = module.getModule();
        this.context = module.getContext();
        this.builder = new llvm.IRBuilder(this.context);
        this.enviroment = new Enviroment();
        this.emitter = new Emitter(this);
    }

    generateFrom(files: ts.SourceFile) {
        files.forEachChild((node: ts.Node) => {
            this.emitter.emitNode(node, this.enviroment.globalScope);
        });
    }
}

export { LLVMGenerator };
