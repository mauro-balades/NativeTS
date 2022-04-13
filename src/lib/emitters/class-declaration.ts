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


import ts = require("typescript");
import Emitter from "../emitter";
import { Scope } from "../enviroment/scopes";
import { LLVMGenerator } from "../generator";
import {
    mangleType,
} from "../mangle";
import { addTypeArguments } from "../tsc-utils";
import { getStructType } from "../types";
import EmitterTemplate from "./template";

class ClassDeclaration extends EmitterTemplate {
    readonly generator: LLVMGenerator;
    readonly emitter: Emitter;

    constructor(emitter: Emitter) {
        super(emitter);
        this.emitter = emitter;
        this.generator = emitter.generator;
    }

    // @ts-ignore
    public override run(
        declaration: ts.ClassDeclaration,
        typeArguments: ReadonlyArray<ts.Type>,
        parentScope: Scope
    ): void {
        if (declaration.typeParameters && typeArguments.length === 0) {
            return;
        }

        const thisType = addTypeArguments(
            this.generator.checker.getTypeAtLocation(declaration),
            typeArguments
        );

        const preExisting = this.generator.module.getTypeByName(
            mangleType(thisType, this.generator.checker)
        );
        if (preExisting) {
            return;
        }

        const isOpaque = !!(
            ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Ambient
        );
        const name = mangleType(thisType, this.generator.checker);
        const type = getStructType(thisType, isOpaque, this.generator);
        const scope = new Scope(name, { declaration, type });
        parentScope.set(name, scope);
        for (const method of declaration.members.filter(
            (member) => !ts.isPropertyDeclaration(member)
        )) {
            this.emitter.emitNode(method, scope);
        }
    }
}

export default ClassDeclaration;
