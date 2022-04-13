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

import llvm = require("llvm-node");
import ts = require("typescript");
import Emitter from "../emitter";
import { Scope } from "../enviroment/scopes";
import { LLVMGenerator } from "../generator";
import { isVarConst } from "../tsc-utils";
import { getLLVMType } from "../types";
import EmitterTemplate from "./template";

class VariableStatement extends EmitterTemplate {
    readonly generator: LLVMGenerator;
    readonly emitter: Emitter;

    constructor(emitter: Emitter) {
        super(emitter);
        this.emitter = emitter;
        this.generator = emitter.generator;
    }

    public override run(
        statement: ts.VariableStatement,
        parentScope: Scope
    ): void {
        for (const declaration of statement.declarationList.declarations) {
            // TODO: Handle destructuring declarations.
            const name = declaration.name.getText();
            const initializer = this.emitExpression(declaration.initializer!);

            if (isVarConst(declaration)) {
                if (!(initializer instanceof llvm.Argument)) {
                    initializer.name = name;
                }
                parentScope.set(name, initializer);
            } else {
                const type =
                    this.generator.checker.getTypeAtLocation(declaration);

                const builder = new llvm.IRBuilder(
                    // @ts-ignore
                    this.generator.builder
                        .getInsertBlock()
                        .parent!.getEntryBlock()!
                );
                const arraySize = undefined;
                const alloca = builder.createAlloca(
                    getLLVMType(type, this.generator),
                    arraySize,
                    name
                );

                this.generator.builder.createStore(
                    initializer,
                    alloca as llvm.Value,
                    undefined
                );
                parentScope.set(name, alloca);
            }
        }
    }
}

export default VariableStatement;
