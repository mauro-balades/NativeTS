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

import argv from "./cli";

function main() {
    let files = argv.args;
    const options: ts.CompilerOptions = prepare_options();

    const host = ts.createCompilerHost(options);
    const program = ts.createProgram(files, options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (diagnostics.length > 0) {
        process.stdout.write(
            ts.formatDiagnosticsWithColorAndContext(diagnostics, host)
        );
        process.exit(1);
    }

    console.log(program);

    console.log(files);
}

/// OTHER FUNCTIONS ////

function prepare_options() {
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
