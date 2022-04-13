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

import { LLVMGenerator } from "./generator";
import { Scope } from "./enviroment/scopes";
import {
    createGCAllocate,
    getBuiltin,
    isLLVMString,
    isValueType,
    keepInsertionPoint,
    newLLVMFunction,
} from "./utils";
import { getLLVMType, getStringType, getStructType } from "./types";
import {
    getDeclarationBaseName,
    mangleFunctionDeclaration,
    mangleType,
} from "./mangle";
import { addTypeArguments, isMethodReference, isVarConst } from "./tsc-utils";
import VariableStatement from "./emitters/variable-statement";
import EmitterGenerator from "./emitters/gen/generation";
import FunctionDeclaration from "./emitters/function-declaration";

class Emitter {
    readonly generator: LLVMGenerator;
    readonly gen: EmitterGenerator;

    readonly variableStatement: VariableStatement;
    readonly functionDeclaration: FunctionDeclaration;

    constructor(generator: LLVMGenerator) {
        this.generator = generator;

        this.variableStatement = new VariableStatement(this);
        this.functionDeclaration = new FunctionDeclaration(this);

        this.gen = new EmitterGenerator(this);
    }

    emitNode(node: ts.Node, scope: Scope): void {
        switch (node.kind) {
            case ts.SyntaxKind.Block:
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.ReturnStatement:
            case ts.SyntaxKind.VariableStatement:
                if (scope === this.generator.enviroment.globalScope) {
                    let fn = this.generator.module.getFunction("main");

                    if (typeof fn != "undefined") {
                        let blocks = fn.getBasicBlocks();

                        if (blocks.length != 0) {
                            this.generator.builder.setInsertionPoint(
                                R.last(blocks)!
                            );
                        }
                    }
                }
                break;
        }

        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.Constructor:
                break;

            case ts.SyntaxKind.ExpressionStatement:
                this.gen.emitExpressionStatement(
                    node as ts.ExpressionStatement
                );
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                this.visitInterfaceDeclaration(
                    node as ts.InterfaceDeclaration,
                    scope
                );
                break;
            case ts.SyntaxKind.ClassDeclaration:
                this.emitClassDeclaration(
                    node as ts.ClassDeclaration,
                    [],
                    scope
                );
                break;
            case ts.SyntaxKind.Block:
                this.emitBlock(node as ts.Block);
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                this.emitModuleDeclaration(node as ts.ModuleDeclaration, scope);
                break;
            case ts.SyntaxKind.VariableStatement:
                this.variableStatement.run(node as ts.VariableStatement, scope);
                break;
            case ts.SyntaxKind.EndOfFileToken:
                break;
            default:
                console.log(
                    `Warning: Unhandled ts.Node '${
                        ts.SyntaxKind[node.kind]
                    }': ${node.getText()}`
                );
        }
    }

    /// DECLARATIONS ///
    visitInterfaceDeclaration(
        declaration: ts.InterfaceDeclaration,
        parentScope: Scope
    ) {
        const name = declaration.name.text;
        parentScope.set(name, new Scope(name));

        if (name === "String") {
            parentScope.set(
                "string",
                new Scope(name, {
                    declaration,
                    type: getStringType(this.generator.context),
                })
            );
        }
    }

    emitClassDeclaration(
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
            this.emitNode(method, scope);
        }
    }

    emitModuleDeclaration(
        declaration: ts.ModuleDeclaration,
        parentScope: Scope
    ): void {
        const name = declaration.name.text;
        const scope = new Scope(name);
        declaration.body!.forEachChild((node) => this.emitNode(node, scope));
        parentScope.set(name, scope);
    }

    /// STATEMENTS ///
    emitBlock(block: ts.Block): void {
        this.generator.enviroment.withScope(undefined, (scope) => {
            for (const statement of block.statements) {
                this.emitNode(statement, scope);
            }
        });
    }
}

export default Emitter;
