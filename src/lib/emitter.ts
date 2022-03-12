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

class Emitter {
    readonly generator: LLVMGenerator;

    constructor(generator: LLVMGenerator) {
        this.generator = generator;
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
                this.emitVariableStatement(node as ts.VariableStatement, scope)
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
            case ts.SyntaxKind.StringLiteral:
                return this.emitLiteralExpression(
                    expression as ts.LiteralExpression
                );
            case ts.SyntaxKind.NewExpression:
                return this.emitNewExpression(expression as ts.NewExpression);
            case ts.SyntaxKind.CallExpression:
                return this.emitCallExpression(expression as ts.CallExpression);
            case ts.SyntaxKind.PropertyAccessExpression:
                return this.emitPropertyAccessExpression(expression as ts.PropertyAccessExpression)
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

    emitFunctionDeclaration(
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
                        this.emitNode(node, bodyScope)
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

    /// EXPRESSIONS ///

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

    emitPropertyAccessExpression(expression: ts.PropertyAccessExpression): any {

        let object = expression.expression;
        let property = expression.name.text;

        switch (property) {
            // TODO: length
            default:
                if (ts.isIdentifier(object)) {
                    const value = this.generator.enviroment.get((object as ts.Identifier).text);
                    if (value instanceof Scope) {
                        return value.get(property) as llvm.Value;
                    }
                }
        }

    }

    emitNewExpression(expression: ts.NewExpression): llvm.Value {
        const declaration = this.generator.checker.getSymbolAtLocation(expression.expression)!.valueDeclaration;

        // @ts-ignore
        if (!ts.isClassDeclaration(declaration)) {
          throw Error("Cannot 'new' non-class type");
        }
      
        const constructorDeclaration = declaration.members.find(ts.isConstructorDeclaration);
      
        if (!constructorDeclaration) {
            throw Error("Calling 'new' requires the type to have a constructor");
        }
      
        const argumentTypes = expression.arguments!.map(this.generator.checker.getTypeAtLocation);
        const thisType = this.generator.checker.getTypeAtLocation(expression);

        const constructor = keepInsertionPoint(this.generator.builder, () => {
          return this.emitFunctionDeclaration(constructorDeclaration, thisType, argumentTypes)!;
        });
      
        const args = expression.arguments!.map(argument => this.emitExpression(argument));
        return this.generator.builder.createCall(constructor, args);
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
                let expr = expression as ts.NumericLiteral;
                return llvm.ConstantFP.get(
                    this.generator.context,
                    parseFloat(expr.text)
                );
            case ts.SyntaxKind.StringLiteral: {

                let expr = expression as ts.StringLiteral;
                const ptr = this.generator.builder.createGlobalStringPtr(expr.text) as llvm.Constant;
                const length = llvm.ConstantInt.get(this.generator.context, expr.text.length);
                return llvm.ConstantStruct.get(getStringType(this.generator.context), [ptr, length]);
            }

            default:
                throw Error(
                    `Unhandled ts.LiteralExpression literal value '${
                        ts.SyntaxKind[expression.kind]
                    }'`
                );
        }
    }

    emitCallExpression(expression: ts.CallExpression): llvm.Value {
        const isMethod = isMethodReference(
            expression.expression,
            this.generator.checker
        );
        const declaration = this.generator.checker.getSymbolAtLocation(
            expression.expression
        )!.valueDeclaration;
        let thisType: ts.Type | undefined;
        if (isMethod) {
            const methodReference =
                expression.expression as ts.PropertyAccessExpression;
            thisType = this.generator.checker.getTypeAtLocation(
                methodReference.expression
            );
        }

        const argumentTypes = expression.arguments.map(
            this.generator.checker.getTypeAtLocation
        );
        const callee = this.getOrEmitFunctionForCall(
            declaration as ts.FunctionLikeDeclaration,
            thisType,
            argumentTypes
        );

        const args = expression.arguments.map((argument) =>
            this.emitExpression(argument)
        );

        if (isMethod) {
            const propertyAccess =
                expression.expression as ts.PropertyAccessExpression;
            args.unshift(this.emitExpression(propertyAccess.expression));
        }

        return this.generator.builder.createCall(callee, args);
    }

    getOrEmitFunctionForCall(
        declaration: ts.Declaration,
        thisType: ts.Type | undefined,
        argumentTypes: ts.Type[]
    ) {
        if (
            !ts.isFunctionDeclaration(declaration) &&
            !ts.isMethodDeclaration(declaration) &&
            !ts.isMethodSignature(declaration) &&
            !ts.isIndexSignatureDeclaration(declaration) &&
            !ts.isPropertyDeclaration(declaration) &&
            !ts.isConstructorDeclaration(declaration)
        ) {
            throw Error(
                `Invalid function call target '${getDeclarationBaseName(
                    declaration
                )}' (${ts.SyntaxKind[declaration.kind]})`
            );
        }

        return keepInsertionPoint(this.generator.builder, () => {
            return this.emitFunctionDeclaration(
                declaration as ts.FunctionLikeDeclaration,
                thisType,
                argumentTypes
            )!;
        });
    }

    /// STATEMENTS ///
    emitBlock(block: ts.Block): void {
        this.generator.enviroment.withScope(undefined, scope => {
          for (const statement of block.statements) {
            this.emitNode(statement, scope);
          }
        });
    }

    emitVariableStatement(
        statement: ts.VariableStatement,
        parentScope: Scope
      ): void {
        for (const declaration of statement.declarationList.declarations) {
          // TODO: Handle destructuring declarations.
          const name = declaration.name.getText();
          const initializer = this.emitExpression(declaration.initializer!);
      
          if (isVarConst(declaration)) {
            if (!(initializer instanceof llvm.Argument)) {
              initializer.name = name;
            }
            parentScope.set(name, initializer);
          } else {
            const type = this.generator.checker.getTypeAtLocation(declaration);

            // @ts-ignore
            const builder = new llvm.IRBuilder(this.generator.builder.getInsertBlock().parent!.getEntryBlock()!);
            const arraySize = undefined;
            const alloca = builder.createAlloca(getLLVMType(type, this.generator), arraySize, name);

            this.generator.builder.createStore(initializer, alloca as llvm.Value, undefined);
            parentScope.set(name, alloca);
          }
        }
    }
}

export default Emitter;
