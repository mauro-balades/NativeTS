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
import { getBuiltin, isLLVMString, isValueType } from "./utils";
import { getStringType, getStructType } from "./types";
import { mangleType } from "./mangle";
import { addTypeArguments } from "./tsc-utils";

class Emitter {
    readonly generator: LLVMGenerator;

    constructor(generator: LLVMGenerator) {
        this.generator = generator;
    }

    emitNode(node: ts.Node, scope: Scope): void {

        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.IndexSignature:
            case ts.SyntaxKind.Constructor:
                // Emitted when called.
                break;

            case ts.SyntaxKind.ExpressionStatement:
                this.emitExpressionStatement(node as ts.ExpressionStatement);
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                this.visitInterfaceDeclaration(
                    node as ts.InterfaceDeclaration,
                    scope
                );
                break;
            case ts.SyntaxKind.ClassDeclaration:
                this.emitClassDeclaration(node as ts.ClassDeclaration, [], scope);
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                this.emitModuleDeclaration(node as ts.ModuleDeclaration, scope);
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

    /// GENERATION FUNCTIONS ///

    emitExpressionStatement(statement: ts.ExpressionStatement): void {
        this.emitLvalueExpression(statement.expression);
    }

    emitLvalueExpression(expression: ts.Expression): llvm.Value {
        switch (expression.kind) {
            case ts.SyntaxKind.PrefixUnaryExpression:
                return this.emitPrefixUnaryExpression(
                    expression as ts.PrefixUnaryExpression
                );
            case ts.SyntaxKind.BinaryExpression:
                return this.emitBinaryExpression(
                    expression as ts.BinaryExpression
                );
            case ts.SyntaxKind.FirstLiteralToken:
                return this.emitLiteralExpression(
                    expression as ts.LiteralExpression
                );
            default:
                throw Error(
                    `Unhandled ts.Expression '${
                        ts.SyntaxKind[expression.kind]
                    }'`
                );
        }
    }

    emitBinaryExpression(expression: ts.BinaryExpression): llvm.Value {
        const { left, right } = expression;

        switch (expression.operatorToken.kind) {
            case ts.SyntaxKind.EqualsToken:
                throw Error("TODO: equal token");
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
                return this.generator.builder.createFCmpOEQ(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                return this.generator.builder.createFCmpONE(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.LessThanToken:
                return this.generator.builder.createFCmpOLT(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.GreaterThanToken:
                return this.generator.builder.createFCmpOGT(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.LessThanEqualsToken:
                return this.generator.builder.createFCmpOLE(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.GreaterThanEqualsToken:
                return this.generator.builder.createFCmpOGE(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.PlusToken:
                return this.emitBinaryPlus(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.MinusToken:
                return this.generator.builder.createFSub(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.AsteriskToken:
                return this.generator.builder.createFMul(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.SlashToken:
                return this.generator.builder.createFDiv(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            case ts.SyntaxKind.PercentToken:
                return this.generator.builder.createFRem(
                    this.emitExpression(left),
                    this.emitExpression(right)
                );
            default:
                throw Error(
                    `Unhandled ts.BinaryExpression operator '${
                        ts.SyntaxKind[expression.operatorToken.kind]
                    }'`
                );
        }
    }

    emitExpression(expression: ts.Expression): llvm.Value {
        return this.convertToRvalue(this.emitLvalueExpression(expression));
    }

    convertToRvalue(value: llvm.Value) {
        if (value.type.isPointerTy() && isValueType(value.type.elementType)) {
            return this.generator.builder.createLoad(
                value,
                value.name + ".load"
            );
        }
        return value;
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
        declaration.body!.forEachChild((node) =>
            this.emitNode(node, scope)
        );
        parentScope.set(name, scope);
    }

    /// EXPRESIONS ///

    emitPrefixUnaryExpression(
        expression: ts.PrefixUnaryExpression
    ): llvm.Value {
        const { operand } = expression;

        switch (expression.operator) {
            case ts.SyntaxKind.PlusToken:
                return this.emitExpression(operand);

            default:
                throw Error(
                    `Unhandled ts.PrefixUnaryOperator operator '${
                        ts.SyntaxKind[expression.operator]
                    }'`
                );
        }
    }

    emitBinaryPlus(left: llvm.Value, right: llvm.Value): llvm.Value {
        if (left.type.isDoubleTy() && right.type.isDoubleTy()) {
            return this.generator.builder.createFAdd(left, right);
        }

        if (isLLVMString(left.type) && isLLVMString(right.type)) {
            const concat = getBuiltin(
                "string__concat",
                this.generator.context,
                this.generator.module
            );
            return this.generator.builder.createCall(concat.callee, [
                left,
                right,
            ]);
        }

        throw Error("Invalid operand types to binary plus");
    }

    emitLiteralExpression(expression: ts.LiteralExpression): llvm.Value {
        switch (expression.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return llvm.ConstantFP.get(
                    this.generator.context,
                    parseFloat(expression.text)
                );

            default:
                throw Error(
                    `Unhandled ts.LiteralExpression literal value '${
                        ts.SyntaxKind[expression.kind]
                    }'`
                );
        }
    }
}

export default Emitter;
