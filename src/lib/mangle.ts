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
import { getTypeArguments, getTypeBaseName } from "./tsc-utils";

export function getDeclarationBaseName(declaration: ts.NamedDeclaration) {
    switch (declaration.kind) {
        case ts.SyntaxKind.Constructor:
            return "constructor";
        case ts.SyntaxKind.IndexSignature:
            return "subscript";
        default:
            return declaration.name!.getText();
    }
}

export function mangleFunctionDeclaration(
    declaration: ts.NamedDeclaration,
    thisType: ts.Type | undefined,
    checker: ts.TypeChecker
): string {
    const { parent } = declaration;
    let parentName: string | undefined;

    if (
        !thisType &&
        (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent))
    ) {
        throw Error("Mangling methods requires thisType");
    }

    if (thisType) {
        parentName = mangleType(thisType, checker);
    } else if (ts.isModuleBlock(parent)) {
        parentName = parent.parent.name.text;
    }

    const scopePrefix = parentName ? parentName + "__" : "";
    const baseName = getDeclarationBaseName(declaration);
    return scopePrefix + baseName;
}

export function mangleType(type: ts.Type, checker: ts.TypeChecker): string {
    const typeArguments = getTypeArguments(type).map((typeArgument: ts.Type) =>
        mangleType(typeArgument, checker)
    );
    return [getTypeBaseName(type, checker), ...typeArguments].join("__");
}
