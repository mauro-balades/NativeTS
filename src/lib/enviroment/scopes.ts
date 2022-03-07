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

import * as llvm from "llvm-node";
import ScopeData from "../interfaces/scope_data";

type ScopeValue = llvm.Value | Scope;

export class Scope extends Map<string, ScopeValue> {
    readonly name: string | undefined;
    readonly data: ScopeData | undefined;

    constructor(name: string | undefined, data?: ScopeData) {
        super();
        this.name = name;
        this.data = data;
    }

    getOptional(identifier: string): ScopeValue | undefined {
        return super.get(identifier);
    }

    overwrite(identifier: string, value: ScopeValue) {
        if (this.getOptional(identifier)) {
            return super.set(identifier, value);
        }

        throw Error(
            `Identifier '${identifier}' being overwritten not found in symbol table`
        );
    }

    get(identifier: string): ScopeValue {
        const value = this.getOptional(identifier);
        if (value) {
            return value;
        }

        throw Error(`Unknown identifier '${identifier}'`);
    }

    set(identifier: string, value: ScopeValue) {
        if (!this.getOptional(identifier)) {
            return super.set(identifier, value);
        }

        throw Error(`Overwriting identifier '${identifier}' in symbol table`);
    }
}
