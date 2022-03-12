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

import { privateEncrypt } from "crypto";
import * as llvm from "llvm-node";
import * as ts from "typescript";
import { LLVMGenerator } from "./generator";
import { isProperty } from "./tsc-utils";
import { getStringType } from "./types";
import { BuiltinName } from "./types/builtin_name";

/// EXPORTS ///

export function newLLVMFunction(
    retT: llvm.Type,
    paramT: llvm.Type[],
    fName: string,
    module: llvm.Module
): llvm.Function {
    // This is the factory function for the FunctionType class.
    // definition:
    //   * https://llvm.org/doxygen/classllvm_1_1FunctionType.html#a7e89b55242c964ae61b7850e99cacef0
    const type = llvm.FunctionType.get(retT, paramT, false);

    const linkage = llvm.LinkageTypes.ExternalLinkage;
    return llvm.Function.create(type, linkage, fName, module);
}

export function isLLVMString(type: llvm.Type) {
    return type.isStructTy() && type.name === "string";
}

export function isValueType(type: llvm.Type) {
    return (
        type.isDoubleTy() ||
        type.isIntegerTy() ||
        type.isPointerTy() ||
        isLLVMString(type)
    );
}

export function getStoredProperties(type: ts.Type, checker: ts.TypeChecker) {
    return checker.getPropertiesOfType(type).filter(isProperty);
}

function getBuiltinFunctionType(name: BuiltinName, context: llvm.LLVMContext) {
    switch (name) {
        case "gc__allocate":
            return llvm.FunctionType.get(
                llvm.Type.getInt8PtrTy(context),
                [llvm.Type.getInt32Ty(context)],
                false
            );
        case "string__concat":
            return llvm.FunctionType.get(
                getStringType(context),
                [getStringType(context), getStringType(context)],
                false
            );
    }
}

export function createGCAllocate(type: llvm.Type, generator: LLVMGenerator) {
    if (isValueType(type)) {
        throw Error(
            `Allocating value types not supported, tried to allocate '${type}'`
        );
    }
    const size = generator.module.dataLayout.getTypeStoreSize(type);
    const allocate = getBuiltin(
        "gc__allocate",
        generator.context,
        generator.module
    );

    const functionType = allocate.functionType;
    const returnValue = generator.builder.createCall(functionType, allocate.callee, [
        llvm.ConstantInt.get(generator.context, size, 32),
    ]);

    return generator.builder.createBitCast(returnValue, type.getPointerTo());
}

export function keepInsertionPoint<T>(
    builder: llvm.IRBuilder,
    emit: () => T
): T {
    const backup = builder.getInsertBlock();
    const result = emit();

    // @ts-ignore
    builder.setInsertionPoint(backup);
    return result;
}

export function getBuiltin(
    name: BuiltinName,
    context: llvm.LLVMContext,
    module: llvm.Module
) {
    return module.getOrInsertFunction(
        name,
        getBuiltinFunctionType(name, context)
    );
}
