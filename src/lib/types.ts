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
import * as ts from "typescript";

import { LLVMGenerator } from "./generator";
import { mangleType } from "./mangle";
import { isObject, isString } from "./tsc-utils";
import { getStoredProperties } from "./utils";

let stringType: llvm.StructType | undefined;

export function getLLVMType(
    type: ts.Type,
    generator: LLVMGenerator
): llvm.Type {
    const { context, checker } = generator;

    // TODO: Inline literal types where possible.

    if (type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) {
        return llvm.Type.getInt1Ty(context);
    }

    if (type.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
        return llvm.Type.getDoubleTy(context);
    }

    if (isString(type)) {
        return getStringType(context);
    }

    if (isObject(type)) {
        // TODO: Pass correct isOpaque parameter.
        return getStructType(type, false, generator).getPointerTo();
    }

    if (type.flags & ts.TypeFlags.Void) {
        return llvm.Type.getVoidTy(context);
    }

    if (type.flags & ts.TypeFlags.Any) {
        throw Error("'any' type is not supported");
    }

    throw Error(`Unhandled ts.Type '${checker.typeToString(type)}'`);
}

export function getStructType(
    type: ts.ObjectType,
    isOpaque: boolean,
    generator: LLVMGenerator
) {
    const { context, module, checker } = generator;

    const elements = getStoredProperties(type, checker).map((property: any) =>
        getLLVMType(
            checker.getTypeAtLocation(property.valueDeclaration),
            generator
        )
    );

    // @ts-ignore
    const declaration = type.symbol.declarations[0];
    let struct: llvm.StructType | null;

    if (ts.isClassDeclaration(declaration)) {
        const name = mangleType(type, checker);
        struct = module.getTypeByName(name);
        if (!struct) {
            struct = llvm.StructType.create(context, name);
            if (!isOpaque) {
                struct.setBody(elements);
            }
        }
    } else {
        struct = llvm.StructType.get(context, elements);
    }

    return struct;
}

export function getStringType(context: llvm.LLVMContext): llvm.StructType {
    if (!stringType) {
        stringType = llvm.StructType.create(context, "string");
        stringType.setBody([
            llvm.Type.getInt8PtrTy(context),
            llvm.Type.getInt32Ty(context),
        ]);
    }
    return stringType;
}
