/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { Observable } from 'rxjs';
import { LogEntry, Logger } from './logger';
export declare class TransformLogger extends Logger {
    constructor(name: string, transform: (stream: Observable<LogEntry>) => Observable<LogEntry>, parent?: Logger | null);
}
