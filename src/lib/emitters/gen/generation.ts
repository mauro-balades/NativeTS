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
import Emitter from "../../emitter";
import { LLVMGenerator } from "../../generator";
import { isValueType } from "../../utils";
import Expression from "./expr/expressions";

class EmitterGenerator extends Expression {
    readonly emitter: Emitter;
    readonly generator: LLVMGenerator;

    constructor(emitter: Emitter) {
        super(emitter);
        super.gen = this;

        this.emitter = emitter;
        this.generator = emitter.generator;
    }

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
            case ts.SyntaxKind.StringLiteral:
                return this.emitLiteralExpression(
                    expression as ts.LiteralExpression
                );
            case ts.SyntaxKind.NewExpression:
                return this.emitNewExpression(expression as ts.NewExpression);
            case ts.SyntaxKind.CallExpression:
                return this.emitCallExpression(expression as ts.CallExpression);
            case ts.SyntaxKind.PropertyAccessExpression:
                return this.emitPropertyAccessExpression(
                    expression as ts.PropertyAccessExpression
                );
            case ts.SyntaxKind.Identifier:
                let expr = expression as ts.Identifier;
                return this.generator.enviroment.get(expr.text) as llvm.Value;
            case ts.SyntaxKind.ThisKeyword:
                return this.generator.enviroment.get("this") as llvm.Value;
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
        if (value?.type?.isPointerTy() && isValueType(value.type.elementType)) {
            return this.generator.builder.createLoad(
                value,
                value.name + ".load"
            );
        }
        return value;
    }
}

export default EmitterGenerator;
