"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelCapLogger = exports.LevelTransformLogger = void 0;
const logger_1 = require("./logger");
class LevelTransformLogger extends logger_1.Logger {
    name;
    parent;
    levelTransform;
    constructor(name, parent, levelTransform) {
        super(name, parent);
        this.name = name;
        this.parent = parent;
        this.levelTransform = levelTransform;
    }
    log(level, message, metadata = {}) {
        return super.log(this.levelTransform(level), message, metadata);
    }
    createChild(name) {
        return new LevelTransformLogger(name, this, this.levelTransform);
    }
}
exports.LevelTransformLogger = LevelTransformLogger;
class LevelCapLogger extends LevelTransformLogger {
    name;
    parent;
    levelCap;
    static levelMap = {
        debug: { debug: 'debug', info: 'debug', warn: 'debug', error: 'debug', fatal: 'debug' },
        info: { debug: 'debug', info: 'info', warn: 'info', error: 'info', fatal: 'info' },
        warn: { debug: 'debug', info: 'info', warn: 'warn', error: 'warn', fatal: 'warn' },
        error: { debug: 'debug', info: 'info', warn: 'warn', error: 'error', fatal: 'error' },
        fatal: { debug: 'debug', info: 'info', warn: 'warn', error: 'error', fatal: 'fatal' },
    };
    constructor(name, parent, levelCap) {
        super(name, parent, (level) => {
            return (LevelCapLogger.levelMap[levelCap][level] || level);
        });
        this.name = name;
        this.parent = parent;
        this.levelCap = levelCap;
    }
}
exports.LevelCapLogger = LevelCapLogger;
