"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.strategy = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const api_1 = require("./api");
const stableStringify = require('fast-json-stable-stringify');
// eslint-disable-next-line @typescript-eslint/no-namespace
var strategy;
(function (strategy) {
    /**
     * Creates a JobStrategy that serializes every call. This strategy can be mixed between jobs.
     */
    function serialize() {
        let latest = (0, rxjs_1.of)();
        return (handler, options) => {
            const newHandler = (argument, context) => {
                const previous = latest;
                latest = (0, rxjs_1.concat)(previous.pipe((0, operators_1.ignoreElements)()), new rxjs_1.Observable((o) => handler(argument, context).subscribe(o))).pipe((0, operators_1.shareReplay)(0));
                return latest;
            };
            return Object.assign(newHandler, {
                jobDescription: Object.assign({}, handler.jobDescription, options),
            });
        };
    }
    strategy.serialize = serialize;
    /**
     * Creates a JobStrategy that will always reuse a running job, and restart it if the job ended.
     * @param replayMessages Replay ALL messages if a job is reused, otherwise just hook up where it
     *        is.
     */
    function reuse(replayMessages = false) {
        let inboundBus = new rxjs_1.Subject();
        let run = null;
        let state = null;
        return (handler, options) => {
            const newHandler = (argument, context) => {
                // Forward inputs.
                const subscription = context.inboundBus.subscribe(inboundBus);
                if (run) {
                    return (0, rxjs_1.concat)(
                    // Update state.
                    (0, rxjs_1.of)(state), run).pipe((0, operators_1.finalize)(() => subscription.unsubscribe()));
                }
                run = handler(argument, { ...context, inboundBus: inboundBus.asObservable() }).pipe((0, operators_1.tap)((message) => {
                    if (message.kind == api_1.JobOutboundMessageKind.Start ||
                        message.kind == api_1.JobOutboundMessageKind.OnReady ||
                        message.kind == api_1.JobOutboundMessageKind.End) {
                        state = message;
                    }
                }, undefined, () => {
                    subscription.unsubscribe();
                    inboundBus = new rxjs_1.Subject();
                    run = null;
                }), replayMessages ? (0, operators_1.shareReplay)() : (0, operators_1.share)());
                return run;
            };
            return Object.assign(newHandler, handler, options || {});
        };
    }
    strategy.reuse = reuse;
    /**
     * Creates a JobStrategy that will reuse a running job if the argument matches.
     * @param replayMessages Replay ALL messages if a job is reused, otherwise just hook up where it
     *        is.
     */
    function memoize(replayMessages = false) {
        const runs = new Map();
        return (handler, options) => {
            const newHandler = (argument, context) => {
                const argumentJson = stableStringify(argument);
                const maybeJob = runs.get(argumentJson);
                if (maybeJob) {
                    return maybeJob;
                }
                const run = handler(argument, context).pipe(replayMessages ? (0, operators_1.shareReplay)() : (0, operators_1.share)());
                runs.set(argumentJson, run);
                return run;
            };
            return Object.assign(newHandler, handler, options || {});
        };
    }
    strategy.memoize = memoize;
})(strategy = exports.strategy || (exports.strategy = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyYXRlZ3kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9leHBlcmltZW50YWwvam9icy9zdHJhdGVneS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwrQkFBdUQ7QUFDdkQsOENBQW1GO0FBRW5GLCtCQU9lO0FBRWYsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFFOUQsMkRBQTJEO0FBQzNELElBQWlCLFFBQVEsQ0EwSHhCO0FBMUhELFdBQWlCLFFBQVE7SUFVdkI7O09BRUc7SUFDSCxTQUFnQixTQUFTO1FBS3ZCLElBQUksTUFBTSxHQUFzQyxJQUFBLFNBQUUsR0FBRSxDQUFDO1FBRXJELE9BQU8sQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEVBQUU7WUFDMUIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxRQUFXLEVBQUUsT0FBbUMsRUFBRSxFQUFFO2dCQUN0RSxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUM7Z0JBQ3hCLE1BQU0sR0FBRyxJQUFBLGFBQU0sRUFDYixRQUFRLENBQUMsSUFBSSxDQUFDLElBQUEsMEJBQWMsR0FBRSxDQUFDLEVBQy9CLElBQUksaUJBQVUsQ0FBd0IsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQ3RGLENBQUMsSUFBSSxDQUFDLElBQUEsdUJBQVcsRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUV2QixPQUFPLE1BQU0sQ0FBQztZQUNoQixDQUFDLENBQUM7WUFFRixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFO2dCQUMvQixjQUFjLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFD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QztnQkFDdEYsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBRTVCLE9BQU8sR0FBRyxDQUFDO1lBQ2IsQ0FBQyxDQUFDO1lBRUYsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxPQUFPLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzNELENBQUMsQ0FBQztJQUNKLENBQUM7SUF4QmUsZ0JBQU8sVUF3QnRCLENBQUE7QUFDSCxDQUFDLEVBMUhnQixRQUFRLEdBQVIsZ0JBQVEsS0FBUixnQkFBUSxRQTBIeEIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3ViamVjdCwgY29uY2F0LCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgZmluYWxpemUsIGlnbm9yZUVsZW1lbnRzLCBzaGFyZSwgc2hhcmVSZXBsYXksIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IEpzb25WYWx1ZSB9IGZyb20gJy4uLy4uL2pzb24nO1xuaW1wb3J0IHtcbiAgSm9iRGVzY3JpcHRpb24sXG4gIEpvYkhhbmRsZXIsXG4gIEpvYkhhbmRsZXJDb250ZXh0LFxuICBKb2JJbmJvdW5kTWVzc2FnZSxcbiAgSm9iT3V0Ym91bmRNZXNzYWdlLFxuICBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLFxufSBmcm9tICcuL2FwaSc7XG5cbmNvbnN0IHN0YWJsZVN0cmluZ2lmeSA9IHJlcXVpcmUoJ2Zhc3QtanNvbi1zdGFibGUtc3RyaW5naWZ5Jyk7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbmFtZXNwYWNlXG5leHBvcnQgbmFtZXNwYWNlIHN0cmF0ZWd5IHtcbiAgZXhwb3J0IHR5cGUgSm9iU3RyYXRlZ3k8XG4gICAgQSBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgICBJIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIE8gZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWVcbiAgPiA9IChcbiAgICBoYW5kbGVyOiBKb2JIYW5kbGVyPEEsIEksIE8+LFxuICAgIG9wdGlvbnM/OiBQYXJ0aWFsPFJlYWRvbmx5PEpvYkRlc2NyaXB0aW9uPj4sXG4gICkgPT4gSm9iSGFuZGxlcjxBLCBJLCBPPjtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEpvYlN0cmF0ZWd5IHRoYXQgc2VyaWFsaXplcyBldmVyeSBjYWxsLiBUaGlzIHN0cmF0ZWd5IGNhbiBiZSBtaXhlZCBiZXR3ZWVuIGpvYnMuXG4gICAqL1xuICBleHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplPFxuICAgIEEgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgSSBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgICBPIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlXG4gID4oKTogSm9iU3RyYXRlZ3k8QSwgSSwgTz4ge1xuICAgIGxldCBsYXRlc3Q6IE9ic2VydmFibGU8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+PiA9IG9mKCk7XG5cbiAgICByZXR1cm4gKGhhbmRsZXIsIG9wdGlvbnMpID0+IHtcbiAgICAgIGNvbnN0IG5ld0hhbmRsZXIgPSAoYXJndW1lbnQ6IEEsIGNvbnRleHQ6IEpvYkhhbmRsZXJDb250ZXh0PEEsIEksIE8+KSA9PiB7XG4gICAgICAgIGNvbnN0IHByZXZpb3VzID0gbGF0ZXN0O1xuICAgICAgICBsYXRlc3QgPSBjb25jYXQoXG4gICAgICAgICAgcHJldmlvdXMucGlwZShpZ25vcmVFbGVtZW50cygpKSxcbiAgICAgICAgICBuZXcgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+KChvKSA9PiBoYW5kbGVyKGFyZ3VtZW50LCBjb250ZXh0KS5zdWJzY3JpYmUobykpLFxuICAgICAgICApLnBpcGUoc2hhcmVSZXBsYXkoMCkpO1xuXG4gICAgICAgIHJldHVybiBsYXRlc3Q7XG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihuZXdIYW5kbGVyLCB7XG4gICAgICAgIGpvYkRlc2NyaXB0aW9uOiBPYmplY3QuYXNzaWduKHt9LCBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLCBvcHRpb25zKSxcbiAgICAgIH0pO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEpvYlN0cmF0ZWd5IHRoYXQgd2lsbCBhbHdheXMgcmV1c2UgYSBydW5uaW5nIGpvYiwgYW5kIHJlc3RhcnQgaXQgaWYgdGhlIGpvYiBlbmRlZC5cbiAgICogQHBhcmFtIHJlcGxheU1lc3NhZ2VzIFJlcGxheSBBTEwgbWVzc2FnZXMgaWYgYSBqb2IgaXMgcmV1c2VkLCBvdGhlcndpc2UganVzdCBob29rIHVwIHdoZXJlIGl0XG4gICAqICAgICAgICBpcy5cbiAgICovXG4gIGV4cG9ydCBmdW5jdGlvbiByZXVzZTxcbiAgICBBIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIEkgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgTyBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZVxuICA+KHJlcGxheU1lc3NhZ2VzID0gZmFsc2UpOiBKb2JTdHJhdGVneTxBLCBJLCBPPiB7XG4gICAgbGV0IGluYm91bmRCdXMgPSBuZXcgU3ViamVjdDxKb2JJbmJvdW5kTWVzc2FnZTxJPj4oKTtcbiAgICBsZXQgcnVuOiBPYnNlcnZhYmxlPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4gfCBudWxsID0gbnVsbDtcbiAgICBsZXQgc3RhdGU6IEpvYk91dGJvdW5kTWVzc2FnZTxPPiB8IG51bGwgPSBudWxsO1xuXG4gICAgcmV0dXJuIChoYW5kbGVyLCBvcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCBuZXdIYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgICAgICAvLyBGb3J3YXJkIGlucHV0cy5cbiAgICAgICAgY29uc3Qgc3Vic2NyaXB0aW9uID0gY29udGV4dC5pbmJvdW5kQnVzLnN1YnNjcmliZShpbmJvdW5kQnVzKTtcblxuICAgICAgICBpZiAocnVuKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbmNhdChcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBzdGF0ZS5cbiAgICAgICAgICAgIG9mKHN0YXRlKSxcbiAgICAgICAgICAgIHJ1bixcbiAgICAgICAgICApLnBpcGUoZmluYWxpemUoKCkgPT4gc3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCkpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJ1biA9IGhhbmRsZXIoYXJndW1lbnQsIHsgLi4uY29udGV4dCwgaW5ib3VuZEJ1czogaW5ib3VuZEJ1cy5hc09ic2VydmFibGUoKSB9KS5waXBlKFxuICAgICAgICAgIHRhcChcbiAgICAgICAgICAgIChtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmtpbmQgPT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5TdGFydCB8fFxuICAgICAgICAgICAgICAgIG1lc3NhZ2Uua2luZCA9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk9uUmVhZHkgfHxcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmtpbmQgPT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5FbmRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBtZXNzYWdlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgICAgICAgICAgaW5ib3VuZEJ1cyA9IG5ldyBTdWJqZWN0PEpvYkluYm91bmRNZXNzYWdlPEk+PigpO1xuICAgICAgICAgICAgICBydW4gPSBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICApLFxuICAgICAgICAgIHJlcGxheU1lc3NhZ2VzID8gc2hhcmVSZXBsYXkoKSA6IHNoYXJlKCksXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHJ1bjtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKG5ld0hhbmRsZXIsIGhhbmRsZXIsIG9wdGlvbnMgfHwge30pO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEpvYlN0cmF0ZWd5IHRoYXQgd2lsbCByZXVzZSBhIHJ1bm5pbmcgam9iIGlmIHRoZSBhcmd1bWVudCBtYXRjaGVzLlxuICAgKiBAcGFyYW0gcmVwbGF5TWVzc2FnZXMgUmVwbGF5IEFMTCBtZXNzYWdlcyBpZiBhIGpvYiBpcyByZXVzZWQsIG90aGVyd2lzZSBqdXN0IGhvb2sgdXAgd2hlcmUgaXRcbiAgICogICAgICAgIGlzLlxuICAgKi9cbiAgZXhwb3J0IGZ1bmN0aW9uIG1lbW9pemU8XG4gICAgQSBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgICBJIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIE8gZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWVcbiAgPihyZXBsYXlNZXNzYWdlcyA9IGZhbHNlKTogSm9iU3RyYXRlZ3k8QSwgSSwgTz4ge1xuICAgIGNvbnN0IHJ1bnMgPSBuZXcgTWFwPHN0cmluZywgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+PigpO1xuXG4gICAgcmV0dXJuIChoYW5kbGVyLCBvcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCBuZXdIYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgICAgICBjb25zdCBhcmd1bWVudEpzb24gPSBzdGFibGVTdHJpbmdpZnkoYXJndW1lbnQpO1xuICAgICAgICBjb25zdCBtYXliZUpvYiA9IHJ1bnMuZ2V0KGFyZ3VtZW50SnNvbik7XG5cbiAgICAgICAgaWYgKG1heWJlSm9iKSB7XG4gICAgICAgICAgcmV0dXJuIG1heWJlSm9iO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcnVuID0gaGFuZGxlcihhcmd1bWVudCwgY29udGV4dCkucGlwZShyZXBsYXlNZXNzYWdlcyA/IHNoYXJlUmVwbGF5KCkgOiBzaGFyZSgpKTtcbiAgICAgICAgcnVucy5zZXQoYXJndW1lbnRKc29uLCBydW4pO1xuXG4gICAgICAgIHJldHVybiBydW47XG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihuZXdIYW5kbGVyLCBoYW5kbGVyLCBvcHRpb25zIHx8IHt9KTtcbiAgICB9O1xuICB9XG59XG4iXX0=