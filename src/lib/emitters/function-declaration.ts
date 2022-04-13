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
import R = require("ramda");
import ts = require("typescript");
import Emitter from "../emitter";
import { Scope } from "../enviroment/scopes";
import { LLVMGenerator } from "../generator";
import {
    getDeclarationBaseName,
    mangleFunctionDeclaration,
    mangleType,
} from "../mangle";
import { isVarConst } from "../tsc-utils";
import { getLLVMType } from "../types";
import { createGCAllocate, isValueType, newLLVMFunction } from "../utils";
import EmitterTemplate from "./template";

class FunctionDeclaration extends EmitterTemplate {
    readonly generator: LLVMGenerator;
    readonly emitter: Emitter;

    constructor(emitter: Emitter) {
        super(emitter);
        this.emitter = emitter;
        this.generator = emitter.generator;
    }

    // @ts-ignore
    public override run(
        declaration: ts.FunctionLikeDeclaration,
        tsThisType: ts.Type | undefined,
        argumentTypes: ts.Type[]
    ): llvm.Function | undefined {
        const preExisting = this.generator.module.getFunction(
            mangleFunctionDeclaration(
                declaration,
                tsThisType,
                this.generator.checker
            )
        );
        if (preExisting) {
            return preExisting;
        }

        let parentScope = undefined;
        if (tsThisType) {
            parentScope = this.generator.enviroment.get(
                mangleType(tsThisType, this.generator.checker)
            ) as Scope;
        }

        const { parent } = declaration;

        if (ts.isSourceFile(parent)) {
            parentScope = this.generator.enviroment.globalScope;
        } else if (ts.isModuleBlock(parent)) {
            parentScope = this.generator.enviroment.get(
                parent.parent.name.text
            ) as Scope;
        } else if (ts.isClassDeclaration(parent)) {
            parentScope = this.generator.enviroment.get(
                // @ts-ignore
                parent.name.escapedText
            ) as Scope;
        } else {
            throw Error(
                `Unhandled function declaration parent kind '${
                    ts.SyntaxKind[parent.kind]
                }'`
            );
        }

        const isConstructor = ts.isConstructorDeclaration(declaration);
        const hasThisParameter =
            ts.isMethodDeclaration(declaration) ||
            ts.isMethodSignature(declaration) ||
            ts.isIndexSignatureDeclaration(declaration) ||
            ts.isPropertyDeclaration(declaration);
        const thisType = tsThisType
            ? (
                  this.generator.enviroment.get(
                      mangleType(tsThisType, this.generator.checker)
                  ) as Scope
              ).data!.type
            : undefined;
        let thisValue: llvm.Value;

        let tsReturnType: ts.Type;
        if (ts.isIndexSignatureDeclaration(declaration) && tsThisType) {
            tsReturnType = this.generator.checker.getIndexTypeOfType(
                tsThisType,
                ts.IndexKind.Number
            )!;
        } else {
            if (ts.isPropertyDeclaration(declaration)) {
                tsReturnType = this.generator.checker.getTypeFromTypeNode(
                    // @ts-ignore
                    declaration.type!
                );
            } else {
                const signature =
                    this.generator.checker.getSignatureFromDeclaration(
                        declaration
                    )!;
                tsReturnType = signature.getReturnType();
            }
        }

        let returnType = isConstructor
            ? thisType!.getPointerTo()
            : getLLVMType(tsReturnType, this.generator);
        if (ts.isIndexSignatureDeclaration(declaration)) {
            returnType = returnType.getPointerTo();
        }
        const parameterTypes = argumentTypes.map((argumentType) =>
            getLLVMType(argumentType, this.generator)
        );
        if (hasThisParameter) {
            parameterTypes.unshift(
                isValueType(thisType!) ? thisType! : thisType!.getPointerTo()
            );
        }
        const qualifiedName = mangleFunctionDeclaration(
            declaration,
            tsThisType,
            this.generator.checker
        );
        const func = newLLVMFunction(
            returnType,
            parameterTypes,
            qualifiedName,
            this.generator.module
        );
        const body =
            ts.isMethodSignature(declaration) ||
            ts.isIndexSignatureDeclaration(declaration) ||
            ts.isPropertyDeclaration(declaration)
                ? undefined
                : declaration.body;

        if (body) {
            this.generator.enviroment.withScope(
                qualifiedName,
                (bodyScope: Scope) => {
                    const parameterNames = ts.isPropertyDeclaration(declaration)
                        ? []
                        : this.generator.checker
                              .getSignatureFromDeclaration(declaration)!
                              .parameters.map(
                                  (parameter: any) => parameter.name
                              );

                    if (hasThisParameter) {
                        parameterNames.unshift("this");
                    }
                    for (const [parameterName, argument] of R.zip(
                        parameterNames,
                        func.getArguments()
                    )) {
                        // @ts-ignore
                        argument.name = parameterName;

                        // @ts-ignore
                        bodyScope.set(parameterName, argument);
                    }

                    const entryBlock = llvm.BasicBlock.create(
                        this.generator.context,
                        "entry",
                        func
                    );
                    this.generator.builder.setInsertionPoint(entryBlock);

                    if (isConstructor) {
                        thisValue = createGCAllocate(thisType!, this.generator);
                        bodyScope.set("this", thisValue);
                    }

                    body.forEachChild((node: any) =>
                        this.emitter.emitNode(node, bodyScope)
                    );

                    if (
                        // @ts-ignore
                        !this.generator.builder.getInsertBlock().getTerminator()
                    ) {
                        if (returnType.isVoidTy()) {
                            this.generator.builder.createRetVoid();
                        } else if (isConstructor) {
                            this.generator.builder.createRet(thisValue);
                        } else {
                            // TODO: Emit LLVM 'unreachable' instruction.
                        }
                    }
                }
            );
        }

        llvm.verifyFunction(func);
        const name = getDeclarationBaseName(declaration);
        parentScope.set(name, func);
        return func;
    }
}

export default FunctionDeclaration;
