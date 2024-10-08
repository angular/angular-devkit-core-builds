/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { JsonObject } from '../json/utils';
import { LogLevel, Logger } from './logger';
export declare class LevelTransformLogger extends Logger {
    readonly name: string;
    readonly parent: Logger | null;
    readonly levelTransform: (level: LogLevel) => LogLevel;
    constructor(name: string, parent: (Logger | null) | undefined, levelTransform: (level: LogLevel) => LogLevel);
    log(level: LogLevel, message: string, metadata?: JsonObject): void;
    createChild(name: string): Logger;
}
export declare class LevelCapLogger extends LevelTransformLogger {
    readonly name: string;
    readonly parent: Logger | null;
    readonly levelCap: LogLevel;
    static levelMap: {
        [cap: string]: {
            [level: string]: string;
        };
    };
    constructor(name: string, parent: (Logger | null) | undefined, levelCap: LogLevel);
}
