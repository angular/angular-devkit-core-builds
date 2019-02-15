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
function createConsoleLogger(verbose = false, stdout = process.stdout, stderr = process.stderr, colors) {
    const logger = new src_1.logging.IndentLogger('cling');
    logger
        .pipe(operators_1.filter(entry => (entry.level != 'debug' || verbose)))
        .subscribe(entry => {
        let color = colors && colors[entry.level];
        let output = stdout;
        switch (entry.level) {
            case 'info':
                break;
            case 'warn':
                color = color || (s => src_1.terminal.bold(src_1.terminal.yellow(s)));
                output = stderr;
                break;
            case 'fatal':
            case 'error':
                color = color || (s => src_1.terminal.bold(src_1.terminal.red(s)));
                output = stderr;
                break;
        }
        // If we do console.log(message) or process.stdout.write(message + '\n'), the process might
        // stop before the whole message is written and the stream is flushed. This happens when
        // streams are asynchronous.
        //
        // NodeJS IO streams are different depending on platform and usage. In POSIX environment,
        // for example, they're asynchronous when writing to a pipe, but synchronous when writing
        // to a TTY. In windows, it's the other way around. You can verify which is which with
        // stream.isTTY and platform, but this is not good enough.
        // In the async case, one should wait for the callback before sending more data or
        // continuing the process. In our case it would be rather hard to do (but not impossible).
        //
        // Instead we take the easy way out and simply chunk the message and call the write
        // function while the buffer drain itself asynchronously. With a smaller chunk size than
        // the buffer, we are mostly certain that it works. In this case, the chunk has been picked
        // as half a page size (4096/2 = 2048), minus some bytes for the color formatting.
        // On POSIX it seems the buffer is 2 pages (8192), but just to be sure (could be different
        // by platform).
        //
        // For more details, see https://nodejs.org/api/process.html#process_a_note_on_process_i_o
        const chunkSize = 2000; // Small chunk.
        let message = entry.message;
        while (message) {
            const chunk = message.slice(0, chunkSize);
            message = message.slice(chunkSize);
            output.write(color ? color(chunk) : chunk);
        }
        output.write('\n');
    });
    return logger;
}
exports.createConsoleLogger = createConsoleLogger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLWxvZ2dlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9ub2RlL2NsaS1sb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCw4Q0FBd0M7QUFDeEMsZ0NBQTJDO0FBTTNDOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CLENBQ2pDLE9BQU8sR0FBRyxLQUFLLEVBQ2YsU0FBd0IsT0FBTyxDQUFDLE1BQU0sRUFDdEMsU0FBd0IsT0FBTyxDQUFDLE1BQU0sRUFDdEMsTUFBaUU7SUFFakUsTUFBTSxNQUFNLEdBQUcsSUFBSSxhQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRWpELE1BQU07U0FDSCxJQUFJLENBQUMsa0JBQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQztTQUMxRCxTQUFTLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDakIsSUFBSSxLQUFLLEdBQUcsTUFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDMUMsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3BCLFFBQVEsS0FBSyxDQUFDLEtBQUssRUFBRTtZQUNuQixLQUFLLE1BQU07Z0JBQ1QsTUFBTTtZQUNSLEtBQUssTUFBTTtnQkFDVCxLQUFLLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxjQUFRLENBQUMsSUFBSSxDQUFDLGNBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMxRCxNQUFNLEdBQUcsTUFBTSxDQUFDO2dCQUNoQixNQUFNO1lBQ1IsS0FBSyxPQUFPLENBQUM7WUFDYixLQUFLLE9BQU87Z0JBQ1YsS0FBSyxHQUFHLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsY0FBUSxDQUFDLElBQUksQ0FBQyxjQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdkQsTUFBTSxHQUFHLE1BQU0sQ0FBQztnQkFDaEIsTUFBTTtTQUNUO1FBRUQsMkZBQTJGO1FBQzNGLHdGQUF3RjtRQUN4Riw0QkFBNEI7UUFDNUIsRUFBRTtRQUNGLHlGQUF5RjtRQUN6Rix5RkFBeUY7UUFDekYsc0ZBQXNGO1FBQ3RGLDBEQUEwRDtRQUMxRCxrRkFBa0Y7UUFDbEYsMEZBQTBGO1FBQzFGLEVBQUU7UUFDRixtRkFBbUY7UUFDbkYsd0ZBQXdGO1FBQ3hGLDJGQUEyRjtRQUMzRixrRkFBa0Y7UUFDbEYsMEZBQTBGO1FBQzFGLGdCQUFnQjtRQUNoQixFQUFFO1FBQ0YsMEZBQTBGO1FBQzFGLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxDQUFFLGVBQWU7UUFDeEMsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUM1QixPQUFPLE9BQU8sRUFBRTtZQUNkLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzFDLE9BQU8sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ25DLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQzVDO1FBQ0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixDQUFDLENBQUMsQ0FBQztJQUVMLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUF6REQsa0RBeURDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgZmlsdGVyIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgbG9nZ2luZywgdGVybWluYWwgfSBmcm9tICcuLi9zcmMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2Nlc3NPdXRwdXQge1xuICB3cml0ZShidWZmZXI6IHN0cmluZyB8IEJ1ZmZlcik6IGJvb2xlYW47XG59XG5cbi8qKlxuICogQSBMb2dnZXIgdGhhdCBzZW5kcyBpbmZvcm1hdGlvbiB0byBTVERPVVQgYW5kIFNUREVSUi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbnNvbGVMb2dnZXIoXG4gIHZlcmJvc2UgPSBmYWxzZSxcbiAgc3Rkb3V0OiBQcm9jZXNzT3V0cHV0ID0gcHJvY2Vzcy5zdGRvdXQsXG4gIHN0ZGVycjogUHJvY2Vzc091dHB1dCA9IHByb2Nlc3Muc3RkZXJyLFxuICBjb2xvcnM/OiBQYXJ0aWFsPFJlY29yZDxsb2dnaW5nLkxvZ0xldmVsLCAoczogc3RyaW5nKSA9PiBzdHJpbmc+Pixcbik6IGxvZ2dpbmcuTG9nZ2VyIHtcbiAgY29uc3QgbG9nZ2VyID0gbmV3IGxvZ2dpbmcuSW5kZW50TG9nZ2VyKCdjbGluZycpO1xuXG4gIGxvZ2dlclxuICAgIC5waXBlKGZpbHRlcihlbnRyeSA9PiAoZW50cnkubGV2ZWwgIT0gJ2RlYnVnJyB8fCB2ZXJib3NlKSkpXG4gICAgLnN1YnNjcmliZShlbnRyeSA9PiB7XG4gICAgICBsZXQgY29sb3IgPSBjb2xvcnMgJiYgY29sb3JzW2VudHJ5LmxldmVsXTtcbiAgICAgIGxldCBvdXRwdXQgPSBzdGRvdXQ7XG4gICAgICBzd2l0Y2ggKGVudHJ5LmxldmVsKSB7XG4gICAgICAgIGNhc2UgJ2luZm8nOlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd3YXJuJzpcbiAgICAgICAgICBjb2xvciA9IGNvbG9yIHx8IChzID0+IHRlcm1pbmFsLmJvbGQodGVybWluYWwueWVsbG93KHMpKSk7XG4gICAgICAgICAgb3V0cHV0ID0gc3RkZXJyO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdmYXRhbCc6XG4gICAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgICBjb2xvciA9IGNvbG9yIHx8IChzID0+IHRlcm1pbmFsLmJvbGQodGVybWluYWwucmVkKHMpKSk7XG4gICAgICAgICAgb3V0cHV0ID0gc3RkZXJyO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB3ZSBkbyBjb25zb2xlLmxvZyhtZXNzYWdlKSBvciBwcm9jZXNzLnN0ZG91dC53cml0ZShtZXNzYWdlICsgJ1xcbicpLCB0aGUgcHJvY2VzcyBtaWdodFxuICAgICAgLy8gc3RvcCBiZWZvcmUgdGhlIHdob2xlIG1lc3NhZ2UgaXMgd3JpdHRlbiBhbmQgdGhlIHN0cmVhbSBpcyBmbHVzaGVkLiBUaGlzIGhhcHBlbnMgd2hlblxuICAgICAgLy8gc3RyZWFtcyBhcmUgYXN5bmNocm9ub3VzLlxuICAgICAgLy9cbiAgICAgIC8vIE5vZGVKUyBJTyBzdHJlYW1zIGFyZSBkaWZmZXJlbnQgZGVwZW5kaW5nIG9uIHBsYXRmb3JtIGFuZCB1c2FnZS4gSW4gUE9TSVggZW52aXJvbm1lbnQsXG4gICAgICAvLyBmb3IgZXhhbXBsZSwgdGhleSdyZSBhc3luY2hyb25vdXMgd2hlbiB3cml0aW5nIHRvIGEgcGlwZSwgYnV0IHN5bmNocm9ub3VzIHdoZW4gd3JpdGluZ1xuICAgICAgLy8gdG8gYSBUVFkuIEluIHdpbmRvd3MsIGl0J3MgdGhlIG90aGVyIHdheSBhcm91bmQuIFlvdSBjYW4gdmVyaWZ5IHdoaWNoIGlzIHdoaWNoIHdpdGhcbiAgICAgIC8vIHN0cmVhbS5pc1RUWSBhbmQgcGxhdGZvcm0sIGJ1dCB0aGlzIGlzIG5vdCBnb29kIGVub3VnaC5cbiAgICAgIC8vIEluIHRoZSBhc3luYyBjYXNlLCBvbmUgc2hvdWxkIHdhaXQgZm9yIHRoZSBjYWxsYmFjayBiZWZvcmUgc2VuZGluZyBtb3JlIGRhdGEgb3JcbiAgICAgIC8vIGNvbnRpbnVpbmcgdGhlIHByb2Nlc3MuIEluIG91ciBjYXNlIGl0IHdvdWxkIGJlIHJhdGhlciBoYXJkIHRvIGRvIChidXQgbm90IGltcG9zc2libGUpLlxuICAgICAgLy9cbiAgICAgIC8vIEluc3RlYWQgd2UgdGFrZSB0aGUgZWFzeSB3YXkgb3V0IGFuZCBzaW1wbHkgY2h1bmsgdGhlIG1lc3NhZ2UgYW5kIGNhbGwgdGhlIHdyaXRlXG4gICAgICAvLyBmdW5jdGlvbiB3aGlsZSB0aGUgYnVmZmVyIGRyYWluIGl0c2VsZiBhc3luY2hyb25vdXNseS4gV2l0aCBhIHNtYWxsZXIgY2h1bmsgc2l6ZSB0aGFuXG4gICAgICAvLyB0aGUgYnVmZmVyLCB3ZSBhcmUgbW9zdGx5IGNlcnRhaW4gdGhhdCBpdCB3b3Jrcy4gSW4gdGhpcyBjYXNlLCB0aGUgY2h1bmsgaGFzIGJlZW4gcGlja2VkXG4gICAgICAvLyBhcyBoYWxmIGEgcGFnZSBzaXplICg0MDk2LzIgPSAyMDQ4KSwgbWludXMgc29tZSBieXRlcyBmb3IgdGhlIGNvbG9yIGZvcm1hdHRpbmcuXG4gICAgICAvLyBPbiBQT1NJWCBpdCBzZWVtcyB0aGUgYnVmZmVyIGlzIDIgcGFnZXMgKDgxOTIpLCBidXQganVzdCB0byBiZSBzdXJlIChjb3VsZCBiZSBkaWZmZXJlbnRcbiAgICAgIC8vIGJ5IHBsYXRmb3JtKS5cbiAgICAgIC8vXG4gICAgICAvLyBGb3IgbW9yZSBkZXRhaWxzLCBzZWUgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19hX25vdGVfb25fcHJvY2Vzc19pX29cbiAgICAgIGNvbnN0IGNodW5rU2l6ZSA9IDIwMDA7ICAvLyBTbWFsbCBjaHVuay5cbiAgICAgIGxldCBtZXNzYWdlID0gZW50cnkubWVzc2FnZTtcbiAgICAgIHdoaWxlIChtZXNzYWdlKSB7XG4gICAgICAgIGNvbnN0IGNodW5rID0gbWVzc2FnZS5zbGljZSgwLCBjaHVua1NpemUpO1xuICAgICAgICBtZXNzYWdlID0gbWVzc2FnZS5zbGljZShjaHVua1NpemUpO1xuICAgICAgICBvdXRwdXQud3JpdGUoY29sb3IgPyBjb2xvcihjaHVuaykgOiBjaHVuayk7XG4gICAgICB9XG4gICAgICBvdXRwdXQud3JpdGUoJ1xcbicpO1xuICAgIH0pO1xuXG4gIHJldHVybiBsb2dnZXI7XG59XG4iXX0=