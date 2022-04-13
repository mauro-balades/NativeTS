import llvm = require("llvm-node");
import ts = require("typescript");
import Emitter from "../../../emitter";
import { Scope } from "../../../enviroment/scopes";
import { LLVMGenerator } from "../../../generator";
import { getDeclarationBaseName } from "../../../mangle";
import { isMethodReference } from "../../../tsc-utils";
import { getStringType } from "../../../types";
import { getBuiltin, isLLVMString, keepInsertionPoint } from "../../../utils";
import EmitterGenerator from "../generation";

class Expression {
    readonly emitter: Emitter;
    readonly generator: LLVMGenerator;
    gen!: EmitterGenerator;

    constructor(emitter: Emitter) {
        this.emitter = emitter;
        this.generator = emitter.generator;
    }

    emitPrefixUnaryExpression(
        expression: ts.PrefixUnaryExpression
    ): llvm.Value {
        const { operand } = expression;

        switch (expression.operator) {
            case ts.SyntaxKind.PlusToken:
                return this.gen.emitExpression(operand);

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
                    const value = this.generator.enviroment.get(
                        (object as ts.Identifier).text
                    );
                    if (value instanceof Scope) {
                        return value.get(property) as llvm.Value;
                    }
                }
        }
    }

    emitNewExpression(expression: ts.NewExpression): llvm.Value {
        const declaration = this.generator.checker.getSymbolAtLocation(
            expression.expression
        )!.valueDeclaration;

        // @ts-ignore
        if (!ts.isClassDeclaration(declaration)) {
            throw Error("Cannot 'new' non-class type");
        }

        const constructorDeclaration = declaration.members.find(
            ts.isConstructorDeclaration
        );

        if (!constructorDeclaration) {
            throw Error(
                "Calling 'new' requires the type to have a constructor"
            );
        }

        const argumentTypes = expression.arguments!.map(
            this.generator.checker.getTypeAtLocation
        );
        const thisType = this.generator.checker.getTypeAtLocation(expression);

        const constructor = keepInsertionPoint(this.generator.builder, () => {
            return this.emitter.functionDeclaration.run(
                constructorDeclaration,
                thisType,
                argumentTypes
            )!;
        });

        const args = expression.arguments!.map((argument) =>
            this.gen.emitExpression(argument)
        );
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
                const ptr = this.generator.builder.createGlobalStringPtr(
                    expr.text
                ) as llvm.Constant;
                const length = llvm.ConstantInt.get(
                    this.generator.context,
                    expr.text.length
                );
                return llvm.ConstantStruct.get(
                    getStringType(this.generator.context),
                    [ptr, length]
                );
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
            this.gen.emitExpression(argument)
        );

        if (isMethod) {
            const propertyAccess =
                expression.expression as ts.PropertyAccessExpression;
            args.unshift(this.gen.emitExpression(propertyAccess.expression));
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
            return this.emitter.functionDeclaration.run(
                declaration as ts.FunctionLikeDeclaration,
                thisType,
                argumentTypes
            )!;
        });
    }
}

export default Expression;
