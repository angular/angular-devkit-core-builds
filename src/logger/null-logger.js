"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullLogger = void 0;
const rxjs_1 = require("rxjs");
const logger_1 = require("./logger");
class NullLogger extends logger_1.Logger {
    constructor(parent = null) {
        super('', parent);
        this._observable = rxjs_1.EMPTY;
    }
    asApi() {
        return {
            createChild: () => new NullLogger(this),
            log() { },
            debug() { },
            info() { },
            warn() { },
            error() { },
            fatal() { },
        };
    }
}
exports.NullLogger = NullLogger;
