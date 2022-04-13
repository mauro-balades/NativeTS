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
import * as R from "ramda";

import { LLVMGenerator } from "./generator";
import { Scope } from "./enviroment/scopes";
import { getStringType } from "./types";

import EmitterGenerator from "./emitters/gen/generation";

import BlockStatement from "./emitters/block-statement";
import VariableStatement from "./emitters/variable-statement";

import FunctionDeclaration from "./emitters/function-declaration";
import ClassDeclaration from "./emitters/class-declaration";
import ModuleDeclaration from "./emitters/module-declaration";

class Emitter {
    readonly generator: LLVMGenerator;
    readonly gen: EmitterGenerator;

    readonly blockStatement      : BlockStatement;
    readonly classDeclaration    : ClassDeclaration;
    readonly variableStatement   : VariableStatement;
    readonly moduleDeclaration   : ModuleDeclaration;
    readonly functionDeclaration : FunctionDeclaration;

    // prettier-ignore
    constructor(generator: LLVMGenerator) {
        this.generator = generator;

        this.blockStatement      = new BlockStatement(this);
        this.classDeclaration    = new ClassDeclaration(this);
        this.moduleDeclaration   = new ModuleDeclaration(this);
        this.variableStatement   = new VariableStatement(this);
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
                this.classDeclaration.run(
                    node as ts.ClassDeclaration,
                    [],
                    scope
                );
                break;
            case ts.SyntaxKind.Block:
                this.emitBlock(node as ts.Block);
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                this.moduleDeclaration.run(node as ts.ModuleDeclaration, scope);
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

    /// STATEMENTS ///
    emitBlock(block: ts.Block): void {
        this.blockStatement.run(block);
    }
}

export default Emitter;
