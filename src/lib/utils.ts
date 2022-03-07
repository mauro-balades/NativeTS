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

import * as llvm from 'llvm-node';

/// EXPORTS ///

export function newLLVMFunction(retT: llvm.Type, paramT: llvm.Type[], fName: string, module: llvm.Module): llvm.Function {

    // This is the factory function for the FunctionType class.
    // definition:
    //   * https://llvm.org/doxygen/classllvm_1_1FunctionType.html#a7e89b55242c964ae61b7850e99cacef0
    const type = llvm.FunctionType.get(retT, paramT, false);

    const linkage = llvm.LinkageTypes.ExternalLinkage;
    return llvm.Function.create(type, linkage, fName, module);
}
