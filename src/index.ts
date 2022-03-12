#!/usr/bin/env node
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
import * as path from "path";
import * as R from "ramda";

import argv from "./cli";
import * as NativeTS from "./lib";
import * as llvm from "llvm-node";
import * as SegfaultHandler from "segfault-handler";

SegfaultHandler.registerHandler("NativeTS-crash.log");

function main() {
    let files = argv.args;
    const options: ts.CompilerOptions = prepareOptions();

    const host = ts.createCompilerHost(options);
    const program = ts.createProgram(files, options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (diagnostics.length > 0) {
        process.stdout.write(
            ts.formatDiagnosticsWithColorAndContext(diagnostics, host)
        );
        process.exit(1);
    }

    llvm.initializeAllTargetInfos();
    llvm.initializeAllTargets();
    llvm.initializeAllTargetMCs();
    llvm.initializeAllAsmParsers();
    llvm.initializeAllAsmPrinters();

    let module = NativeTS.module.createModule(program);
    let generator = new NativeTS.generator.LLVMGenerator(module);
    let builder = generator.builder;
    // llvm.BasicBlock.create(generator.context, "entry", module.mainFunc);

    builder.setInsertionPoint(R.last(module.mainFunc.getBasicBlocks())!);

    for (const sourceFile of program.getSourceFiles()) {
        generator.generateFrom(sourceFile);
    }

    builder.createRet(llvm.Constant.getNullValue(module.mainRetT));

    let mod = module.getModule();

    try {
        llvm.verifyModule(mod);
    } catch (error: any) {
        error.message += "\n" + mod.print();
        throw error;
    }

    console.log(mod.print());
    // llvm.writeBitcodeToFile(mod, "test/compiled.bc")
}

/// OTHER FUNCTIONS ///

function prepareOptions() {
    const options: ts.CompilerOptions = {
        lib: [path.join(__dirname, "..", "llvm", ".ts-llvm.d.ts")],
        types: [],
    };

    return options;
}

/// CALL MAIN FUNCTION ///

try {
    main();
} catch (e) {
    console.error(e);
}
