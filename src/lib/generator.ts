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
import * as R from "ramda";

import { Module } from "./module";
import Enviroment from "./enviroment/enviroment";
import { Scope } from "./enviroment/scopes";

class LLVMGenerator {
    readonly checker: ts.TypeChecker;
    readonly module: llvm.Module;
    readonly context: llvm.LLVMContext;
    readonly builder: llvm.IRBuilder;
    readonly enviroment: Enviroment;

    constructor(module: Module) {
        this.checker = module.getTypeChecker();
        this.module = module.getModule();
        this.context = module.getContext();
        this.builder = new llvm.IRBuilder(this.context);
        this.enviroment = new Enviroment();
    }

    generateFrom(files: ts.SourceFile) {
        files.forEachChild((node: ts.Node) => {
            this.emitNode(node, this.enviroment.globalScope);
        });
    }

    emitNode(node: ts.Node, scope: Scope) {
        switch (node.kind) {
            case ts.SyntaxKind.Block:
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.ReturnStatement:
            case ts.SyntaxKind.VariableStatement:
              if (scope === this.enviroment.globalScope) {

                // @ts-ignore
                this.builder.setInsertionPoint(R.last(this.module.getFunction("main").getBasicBlocks())!);
              }
              break;
        }
    }
}

export { LLVMGenerator };
