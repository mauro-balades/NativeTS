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

export function isVarConst(node: ts.VariableDeclaration | ts.VariableDeclarationList): boolean {
  return !!(ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const);
}

export function getPropertyIndex(name: string, type: ts.Type, checker: ts.TypeChecker): number {
  const properties = checker.getPropertiesOfType(type);
  const index = properties.findIndex(property => property.name === name);

  if (index < 0) {
    throw Error(`Type '${checker.typeToString(type)}' has no property '${name}'`);
  }

  return index;
}

export function getTypeArguments(type: ts.Type) {
  if (type.flags & ts.TypeFlags.Object) {
    if ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
      return (type as ts.TypeReference).typeArguments || [];
    }
  }
  return [];
}

export function addTypeArguments(type: ts.Type, typeArguments: ReadonlyArray<ts.Type>): ts.TypeReference {
  if (type.flags & ts.TypeFlags.Object) {
    if ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
      const typeReference = type as ts.TypeReference;
      return { ...typeReference, typeArguments };
    }
  }

  throw Error("Invalid type");
}

export function isMethodReference(expression: ts.Expression, checker: ts.TypeChecker): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    (checker.getTypeAtLocation(expression).symbol.flags & ts.SymbolFlags.Method) !== 0
  );
}

export function isObject(type: ts.Type): type is ts.ObjectType {
  return !!(type.flags & ts.TypeFlags.Object);
}

export function isArray(type: ts.Type): type is ts.ObjectType {
  return type.symbol && type.symbol.name === "Array";
}

export function isString(type: ts.Type): boolean {
  return !!(type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral));
}

export function getTypeBaseName(type: ts.Type, checker: ts.TypeChecker) {
  return type.symbol ? type.symbol.name : checker.typeToString(checker.getBaseTypeOfLiteralType(type));
}

export function isProperty(symbol: ts.Symbol): boolean {
  return !!(symbol.flags & ts.SymbolFlags.Property);
}