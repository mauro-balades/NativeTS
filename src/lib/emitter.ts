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

import { LLVMGenerator } from "./generator";
import { Scope } from "./enviroment/scopes";
import { isValueType } from "./utils";

class Emitter {

    readonly generator: LLVMGenerator;

    constructor(generator: LLVMGenerator) {
        this.generator = generator;
    }

    emitNode(node: ts.Node, scope: Scope): void {
        switch (node.kind) {
            case ts.SyntaxKind.ExpressionStatement:
                this.emitExpressionStatement(node as ts.ExpressionStatement);
        }
    }

    /// GENERATION FUNCTIONS ///

    emitExpressionStatement(statement: ts.ExpressionStatement): void {
        this.emitLvalueExpression(statement.expression);
    }

    emitLvalueExpression(expression: ts.Expression): llvm.Value {
        switch (expression.kind) {
          case ts.SyntaxKind.PrefixUnaryExpression:
            return this.emitPrefixUnaryExpression(expression as ts.PrefixUnaryExpression);
          default:
            throw Error(`Unhandled ts.Expression '${ts.SyntaxKind[expression.kind]}'`);
        }
    }

    emitExpression(expression: ts.Expression): llvm.Value {
        return this.convertToRvalue(this.emitLvalueExpression(expression));
    }
    
    convertToRvalue(value: llvm.Value) {
        if (value.type.isPointerTy() && isValueType(value.type.elementType)) {
            return this.generator.builder.createLoad(value, value.name + ".load");
        }
        return value;
    }

    /// EXPRESIONS ///

    emitPrefixUnaryExpression(expression: ts.PrefixUnaryExpression): llvm.Value {
        const { operand } = expression;
      
        switch (expression.operator) {
          case ts.SyntaxKind.PlusToken:
            return this.emitExpression(operand);

          case ts.SyntaxKind.MinusToken:
            throw Error(`Unhandled ts.PrefixUnaryOperator operator '${ts.SyntaxKind[expression.operator]}'`);

          case ts.SyntaxKind.PlusPlusToken:
            throw Error(`Unhandled ts.PrefixUnaryOperator operator '${ts.SyntaxKind[expression.operator]}'`);

          case ts.SyntaxKind.MinusMinusToken:
            throw Error(`Unhandled ts.PrefixUnaryOperator operator '${ts.SyntaxKind[expression.operator]}'`);

          case ts.SyntaxKind.TildeToken:
            throw Error(`Unhandled ts.PrefixUnaryOperator operator '${ts.SyntaxKind[expression.operator]}'`);

          case ts.SyntaxKind.ExclamationToken:
            throw Error(`Unhandled ts.PrefixUnaryOperator operator '${ts.SyntaxKind[expression.operator]}'`);
        }
      }
}

export default Emitter;
