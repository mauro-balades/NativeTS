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

import { ScopeValue } from "../types/scope_value";
import { Scope } from "./scopes";

import * as R from "ramda";

class Enviroment {
    private readonly scopes: Scope[];

    constructor() {
        this.scopes = [new Scope(undefined)];
    }

    withScope(
        scopeName: string | undefined,
        body: (scope: Scope) => void
    ): void {
        const scope = new Scope(scopeName);
        this.scopes.push(scope);

        body(scope);
        this.scopes.pop();
    }

    /// GET FUNCTIONS ///
    get globalScope(): Scope {
        return this.scopes[0]; // First scope is considered as global
    }

    get currentScope(): Scope {
        return this.scopes[this.scopes.length - 1];
    }

    get(identifier: string): ScopeValue {
        const parts = identifier.split(".");

        if (parts.length > 1) {
            const scope = this.get(parts[0]);
            if (!(scope instanceof Scope)) {
                throw Error(`'${parts[0]}' is not a namespace`);
            }
            return scope.get(parts.slice(1).join("."));
        }

        for (const scope of R.reverse(this.scopes)) {
            const value = scope.getOptional(identifier);
            if (value) {
                return value;
            }
        }

        throw Error(`Unknown identifier '${identifier}'`);
    }
}

export default Enviroment;
