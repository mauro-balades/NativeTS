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
import EmitterTemplate from "./template";

class ModuleDeclaration extends EmitterTemplate {
    readonly generator: LLVMGenerator;
    readonly emitter: Emitter;

    constructor(emitter: Emitter) {
        super(emitter);
        this.emitter = emitter;
        this.generator = emitter.generator;
    }

    public override run(
        declaration: ts.ModuleDeclaration,
        parentScope: Scope
    ): void {
        const name = declaration.name.text;
        const scope = new Scope(name);
        declaration.body!.forEachChild((node) => this.emitter.emitNode(node, scope));
        parentScope.set(name, scope);
    }
}

export default ModuleDeclaration;
