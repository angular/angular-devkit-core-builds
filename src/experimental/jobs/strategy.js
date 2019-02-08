"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const api_1 = require("./api");
const stableStringify = require('fast-json-stable-stringify');
var strategy;
(function (strategy) {
    /**
     * Creates a JobStrategy that serializes every call. This strategy can be mixed between jobs.
     */
    function serialize() {
        let latest = rxjs_1.of();
        return (handler, options) => {
            const newHandler = (argument, context) => {
                const previous = latest;
                latest = rxjs_1.concat(previous.pipe(operators_1.ignoreElements()), new rxjs_1.Observable(o => handler(argument, context).subscribe(o))).pipe(operators_1.shareReplay(0));
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
        let runContext = null;
        let run = null;
        let state = null;
        return (handler, options) => {
            const newHandler = (argument, context) => {
                // Forward inputs.
                const subscription = context.inboundBus.subscribe(inboundBus);
                if (run) {
                    return rxjs_1.concat(
                    // Update state.
                    rxjs_1.of(state), run).pipe(operators_1.finalize(() => subscription.unsubscribe()));
                }
                run = handler(argument, Object.assign({}, context, { inboundBus: inboundBus.asObservable() })).pipe(operators_1.tap(message => {
                    if (message.kind == api_1.JobOutboundMessageKind.Start
                        || message.kind == api_1.JobOutboundMessageKind.OnReady
                        || message.kind == api_1.JobOutboundMessageKind.End) {
                        state = message;
                    }
                }, undefined, () => {
                    subscription.unsubscribe();
                    inboundBus = new rxjs_1.Subject();
                    run = null;
                }), replayMessages ? operators_1.shareReplay() : operators_1.share());
                runContext = context;
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
                const run = handler(argument, context).pipe(replayMessages ? operators_1.shareReplay() : operators_1.share());
                runs.set(argumentJson, run);
                return run;
            };
            return Object.assign(newHandler, handler, options || {});
        };
    }
    strategy.memoize = memoize;
})(strategy = exports.strategy || (exports.strategy = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyYXRlZ3kuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2V4cGVyaW1lbnRhbC9qb2JzL3N0cmF0ZWd5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsK0JBQXVEO0FBQ3ZELDhDQUFtRjtBQUVuRiwrQkFNZTtBQUVmLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBRTlELElBQWlCLFFBQVEsQ0FvSXhCO0FBcElELFdBQWlCLFFBQVE7SUFXdkI7O09BRUc7SUFDSCxTQUFnQixTQUFTO1FBS3ZCLElBQUksTUFBTSxHQUFzQyxTQUFFLEVBQUUsQ0FBQztRQUVyRCxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxFQUFFO1lBQzFCLE1BQU0sVUFBVSxHQUFHLENBQUMsUUFBVyxFQUFFLE9BQW1DLEVBQUUsRUFBRTtnQkFDdEUsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDO2dCQUN4QixNQUFNLEdBQUcsYUFBTSxDQUNiLFFBQVEsQ0FBQyxJQUFJLENBQUMsMEJBQWMsRUFBRSxDQUFDLEVBQy9CLElBQUksaUJBQVUsQ0FBd0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUNwRixDQUFDLElBQUksQ0FDSix1QkFBVyxDQUFDLENBQUMsQ0FBQyxDQUNmLENBQUM7Z0JBRUYsT0FBTyxNQUFNLENBQUM7WUFDaEIsQ0FBQyxDQUFDO1lBRUYsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRTtnQkFDL0IsY0FBYyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDO2FBQ25FLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUF4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TyxHQUFHLENBQUM7WUFDYixDQUFDLENBQUM7WUFFRixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7UUFDM0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQTFCZSxnQkFBTyxVQTBCdEIsQ0FBQTtBQUVILENBQUMsRUFwSWdCLFFBQVEsR0FBUixnQkFBUSxLQUFSLGdCQUFRLFFBb0l4QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IE9ic2VydmFibGUsIFN1YmplY3QsIGNvbmNhdCwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGZpbmFsaXplLCBpZ25vcmVFbGVtZW50cywgc2hhcmUsIHNoYXJlUmVwbGF5LCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBKc29uVmFsdWUgfSBmcm9tICcuLi8uLi9qc29uJztcbmltcG9ydCB7XG4gIEpvYkRlc2NyaXB0aW9uLFxuICBKb2JIYW5kbGVyLFxuICBKb2JIYW5kbGVyQ29udGV4dCwgSm9iSW5ib3VuZE1lc3NhZ2UsXG4gIEpvYk91dGJvdW5kTWVzc2FnZSxcbiAgSm9iT3V0Ym91bmRNZXNzYWdlS2luZCxcbn0gZnJvbSAnLi9hcGknO1xuXG5jb25zdCBzdGFibGVTdHJpbmdpZnkgPSByZXF1aXJlKCdmYXN0LWpzb24tc3RhYmxlLXN0cmluZ2lmeScpO1xuXG5leHBvcnQgbmFtZXNwYWNlIHN0cmF0ZWd5IHtcblxuICBleHBvcnQgdHlwZSBKb2JTdHJhdGVneTxcbiAgICBBIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIEkgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgTyBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgPiA9IChcbiAgICBoYW5kbGVyOiBKb2JIYW5kbGVyPEEsIEksIE8+LFxuICAgIG9wdGlvbnM/OiBQYXJ0aWFsPFJlYWRvbmx5PEpvYkRlc2NyaXB0aW9uPj4sXG4gICkgPT4gSm9iSGFuZGxlcjxBLCBJLCBPPjtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEpvYlN0cmF0ZWd5IHRoYXQgc2VyaWFsaXplcyBldmVyeSBjYWxsLiBUaGlzIHN0cmF0ZWd5IGNhbiBiZSBtaXhlZCBiZXR3ZWVuIGpvYnMuXG4gICAqL1xuICBleHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplPFxuICAgIEEgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgSSBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgICBPIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICA+KCk6IEpvYlN0cmF0ZWd5PEEsIEksIE8+IHtcbiAgICBsZXQgbGF0ZXN0OiBPYnNlcnZhYmxlPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4gPSBvZigpO1xuXG4gICAgcmV0dXJuIChoYW5kbGVyLCBvcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCBuZXdIYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgICAgICBjb25zdCBwcmV2aW91cyA9IGxhdGVzdDtcbiAgICAgICAgbGF0ZXN0ID0gY29uY2F0KFxuICAgICAgICAgIHByZXZpb3VzLnBpcGUoaWdub3JlRWxlbWVudHMoKSksXG4gICAgICAgICAgbmV3IE9ic2VydmFibGU8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+PihvID0+IGhhbmRsZXIoYXJndW1lbnQsIGNvbnRleHQpLnN1YnNjcmliZShvKSksXG4gICAgICAgICkucGlwZShcbiAgICAgICAgICBzaGFyZVJlcGxheSgwKSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gbGF0ZXN0O1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24obmV3SGFuZGxlciwge1xuICAgICAgICBqb2JEZXNjcmlwdGlvbjogT2JqZWN0LmFzc2lnbih7fSwgaGFuZGxlci5qb2JEZXNjcmlwdGlvbiwgb3B0aW9ucyksXG4gICAgICB9KTtcbiAgICB9O1xuICB9XG5cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEpvYlN0cmF0ZWd5IHRoYXQgd2lsbCBhbHdheXMgcmV1c2UgYSBydW5uaW5nIGpvYiwgYW5kIHJlc3RhcnQgaXQgaWYgdGhlIGpvYiBlbmRlZC5cbiAgICogQHBhcmFtIHJlcGxheU1lc3NhZ2VzIFJlcGxheSBBTEwgbWVzc2FnZXMgaWYgYSBqb2IgaXMgcmV1c2VkLCBvdGhlcndpc2UganVzdCBob29rIHVwIHdoZXJlIGl0XG4gICAqICAgICAgICBpcy5cbiAgICovXG4gIGV4cG9ydCBmdW5jdGlvbiByZXVzZTxcbiAgICBBIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIEkgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgTyBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgPihyZXBsYXlNZXNzYWdlcyA9IGZhbHNlKTogSm9iU3RyYXRlZ3k8QSwgSSwgTz4ge1xuICAgIGxldCBpbmJvdW5kQnVzID0gbmV3IFN1YmplY3Q8Sm9iSW5ib3VuZE1lc3NhZ2U8ST4+KCk7XG4gICAgbGV0IHJ1bkNvbnRleHQ6IEpvYkhhbmRsZXJDb250ZXh0IHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IHJ1bjogT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+IHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IHN0YXRlOiBKb2JPdXRib3VuZE1lc3NhZ2U8Tz4gfCBudWxsID0gbnVsbDtcblxuICAgIHJldHVybiAoaGFuZGxlciwgb3B0aW9ucykgPT4ge1xuICAgICAgY29uc3QgbmV3SGFuZGxlciA9IChhcmd1bWVudDogQSwgY29udGV4dDogSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4pID0+IHtcbiAgICAgICAgLy8gRm9yd2FyZCBpbnB1dHMuXG4gICAgICAgIGNvbnN0IHN1YnNjcmlwdGlvbiA9IGNvbnRleHQuaW5ib3VuZEJ1cy5zdWJzY3JpYmUoaW5ib3VuZEJ1cyk7XG5cbiAgICAgICAgaWYgKHJ1bikge1xuICAgICAgICAgIHJldHVybiBjb25jYXQoXG4gICAgICAgICAgICAvLyBVcGRhdGUgc3RhdGUuXG4gICAgICAgICAgICBvZihzdGF0ZSksXG4gICAgICAgICAgICBydW4sXG4gICAgICAgICAgKS5waXBlKFxuICAgICAgICAgICAgZmluYWxpemUoKCkgPT4gc3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCkpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBydW4gPSBoYW5kbGVyKGFyZ3VtZW50LCB7IC4uLmNvbnRleHQsIGluYm91bmRCdXM6IGluYm91bmRCdXMuYXNPYnNlcnZhYmxlKCkgfSkucGlwZShcbiAgICAgICAgICB0YXAoXG4gICAgICAgICAgICBtZXNzYWdlID0+IHtcbiAgICAgICAgICAgICAgaWYgKG1lc3NhZ2Uua2luZCA9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlN0YXJ0XG4gICAgICAgICAgICAgICAgICB8fCBtZXNzYWdlLmtpbmQgPT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5PblJlYWR5XG4gICAgICAgICAgICAgICAgICB8fCBtZXNzYWdlLmtpbmQgPT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5FbmQpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IG1lc3NhZ2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgICAgICAgICAgICBpbmJvdW5kQnVzID0gbmV3IFN1YmplY3Q8Sm9iSW5ib3VuZE1lc3NhZ2U8ST4+KCk7XG4gICAgICAgICAgICAgIHJ1biA9IG51bGw7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICksXG4gICAgICAgICAgcmVwbGF5TWVzc2FnZXMgPyBzaGFyZVJlcGxheSgpIDogc2hhcmUoKSxcbiAgICAgICAgKTtcbiAgICAgICAgcnVuQ29udGV4dCA9IGNvbnRleHQ7XG5cbiAgICAgICAgcmV0dXJuIHJ1bjtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKG5ld0hhbmRsZXIsIGhhbmRsZXIsIG9wdGlvbnMgfHwge30pO1xuICAgIH07XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgSm9iU3RyYXRlZ3kgdGhhdCB3aWxsIHJldXNlIGEgcnVubmluZyBqb2IgaWYgdGhlIGFyZ3VtZW50IG1hdGNoZXMuXG4gICAqIEBwYXJhbSByZXBsYXlNZXNzYWdlcyBSZXBsYXkgQUxMIG1lc3NhZ2VzIGlmIGEgam9iIGlzIHJldXNlZCwgb3RoZXJ3aXNlIGp1c3QgaG9vayB1cCB3aGVyZSBpdFxuICAgKiAgICAgICAgaXMuXG4gICAqL1xuICBleHBvcnQgZnVuY3Rpb24gbWVtb2l6ZTxcbiAgICBBIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIEkgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgTyBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgPihyZXBsYXlNZXNzYWdlcyA9IGZhbHNlKTogSm9iU3RyYXRlZ3k8QSwgSSwgTz4ge1xuICAgIGNvbnN0IHJ1bnMgPSBuZXcgTWFwPHN0cmluZywgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+PigpO1xuXG4gICAgcmV0dXJuIChoYW5kbGVyLCBvcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCBuZXdIYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgICAgICBjb25zdCBhcmd1bWVudEpzb24gPSBzdGFibGVTdHJpbmdpZnkoYXJndW1lbnQpO1xuICAgICAgICBjb25zdCBtYXliZUpvYiA9IHJ1bnMuZ2V0KGFyZ3VtZW50SnNvbik7XG5cbiAgICAgICAgaWYgKG1heWJlSm9iKSB7XG4gICAgICAgICAgcmV0dXJuIG1heWJlSm9iO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcnVuID0gaGFuZGxlcihhcmd1bWVudCwgY29udGV4dCkucGlwZShcbiAgICAgICAgICByZXBsYXlNZXNzYWdlcyA/IHNoYXJlUmVwbGF5KCkgOiBzaGFyZSgpLFxuICAgICAgICApO1xuICAgICAgICBydW5zLnNldChhcmd1bWVudEpzb24sIHJ1bik7XG5cbiAgICAgICAgcmV0dXJuIHJ1bjtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKG5ld0hhbmRsZXIsIGhhbmRsZXIsIG9wdGlvbnMgfHwge30pO1xuICAgIH07XG4gIH1cblxufVxuIl19