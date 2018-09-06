"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const operators_1 = require("rxjs/operators");
const src_1 = require("../src");
/**
 * A Logger that sends information to STDOUT and STDERR.
 */
function createConsoleLogger(verbose = false) {
    const logger = new src_1.logging.IndentLogger('cling');
    logger
        .pipe(operators_1.filter(entry => (entry.level != 'debug' || verbose)))
        .subscribe(entry => {
        let color = x => src_1.terminal.dim(src_1.terminal.white(x));
        let output = process.stdout;
        switch (entry.level) {
            case 'info':
                color = src_1.terminal.white;
                break;
            case 'warn':
                color = src_1.terminal.yellow;
                break;
            case 'error':
                color = src_1.terminal.red;
                output = process.stderr;
                break;
            case 'fatal':
                color = (x) => src_1.terminal.bold(src_1.terminal.red(x));
                output = process.stderr;
                break;
        }
        output.write(color(entry.message) + '\n');
    });
    return logger;
}
exports.createConsoleLogger = createConsoleLogger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLWxvZ2dlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9ub2RlL2NsaS1sb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCw4Q0FBd0M7QUFDeEMsZ0NBQTJDO0FBRzNDOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CLENBQUMsT0FBTyxHQUFHLEtBQUs7SUFDakQsTUFBTSxNQUFNLEdBQUcsSUFBSSxhQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRWpELE1BQU07U0FDSCxJQUFJLENBQUMsa0JBQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQztTQUMxRCxTQUFTLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDakIsSUFBSSxLQUFLLEdBQTBCLENBQUMsQ0FBQyxFQUFFLENBQUMsY0FBUSxDQUFDLEdBQUcsQ0FBQyxjQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEUsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUM1QixRQUFRLEtBQUssQ0FBQyxLQUFLLEVBQUU7WUFDbkIsS0FBSyxNQUFNO2dCQUNULEtBQUssR0FBRyxjQUFRLENBQUMsS0FBSyxDQUFDO2dCQUN2QixNQUFNO1lBQ1IsS0FBSyxNQUFNO2dCQUNULEtBQUssR0FBRyxjQUFRLENBQUMsTUFBTSxDQUFDO2dCQUN4QixNQUFNO1lBQ1IsS0FBSyxPQUFPO2dCQUNWLEtBQUssR0FBRyxjQUFRLENBQUMsR0FBRyxDQUFDO2dCQUNyQixNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztnQkFDeEIsTUFBTTtZQUNSLEtBQUssT0FBTztnQkFDVixLQUFLLEdBQUcsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLGNBQVEsQ0FBQyxJQUFJLENBQUMsY0FBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztnQkFDeEIsTUFBTTtTQUNUO1FBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUMsQ0FBQyxDQUFDO0lBRUwsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQTdCRCxrREE2QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBmaWx0ZXIgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBsb2dnaW5nLCB0ZXJtaW5hbCB9IGZyb20gJy4uL3NyYyc7XG5cblxuLyoqXG4gKiBBIExvZ2dlciB0aGF0IHNlbmRzIGluZm9ybWF0aW9uIHRvIFNURE9VVCBhbmQgU1RERVJSLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29uc29sZUxvZ2dlcih2ZXJib3NlID0gZmFsc2UpOiBsb2dnaW5nLkxvZ2dlciB7XG4gIGNvbnN0IGxvZ2dlciA9IG5ldyBsb2dnaW5nLkluZGVudExvZ2dlcignY2xpbmcnKTtcblxuICBsb2dnZXJcbiAgICAucGlwZShmaWx0ZXIoZW50cnkgPT4gKGVudHJ5LmxldmVsICE9ICdkZWJ1ZycgfHwgdmVyYm9zZSkpKVxuICAgIC5zdWJzY3JpYmUoZW50cnkgPT4ge1xuICAgICAgbGV0IGNvbG9yOiAoczogc3RyaW5nKSA9PiBzdHJpbmcgPSB4ID0+IHRlcm1pbmFsLmRpbSh0ZXJtaW5hbC53aGl0ZSh4KSk7XG4gICAgICBsZXQgb3V0cHV0ID0gcHJvY2Vzcy5zdGRvdXQ7XG4gICAgICBzd2l0Y2ggKGVudHJ5LmxldmVsKSB7XG4gICAgICAgIGNhc2UgJ2luZm8nOlxuICAgICAgICAgIGNvbG9yID0gdGVybWluYWwud2hpdGU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3dhcm4nOlxuICAgICAgICAgIGNvbG9yID0gdGVybWluYWwueWVsbG93O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgY29sb3IgPSB0ZXJtaW5hbC5yZWQ7XG4gICAgICAgICAgb3V0cHV0ID0gcHJvY2Vzcy5zdGRlcnI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2ZhdGFsJzpcbiAgICAgICAgICBjb2xvciA9ICh4OiBzdHJpbmcpID0+IHRlcm1pbmFsLmJvbGQodGVybWluYWwucmVkKHgpKTtcbiAgICAgICAgICBvdXRwdXQgPSBwcm9jZXNzLnN0ZGVycjtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgb3V0cHV0LndyaXRlKGNvbG9yKGVudHJ5Lm1lc3NhZ2UpICsgJ1xcbicpO1xuICAgIH0pO1xuXG4gIHJldHVybiBsb2dnZXI7XG59XG4iXX0=