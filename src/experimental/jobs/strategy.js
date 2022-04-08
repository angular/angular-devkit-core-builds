"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.strategy = void 0;
const fast_json_stable_stringify_1 = __importDefault(require("fast-json-stable-stringify"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const api_1 = require("./api");
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
                const argumentJson = (0, fast_json_stable_stringify_1.default)(argument);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyYXRlZ3kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9leHBlcmltZW50YWwvam9icy9zdHJhdGVneS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7QUFFSCw0RkFBeUQ7QUFDekQsK0JBQXVEO0FBQ3ZELDhDQUFtRjtBQUVuRiwrQkFPZTtBQUVmLDJEQUEyRDtBQUMzRCxJQUFpQixRQUFRLENBMEh4QjtBQTFIRCxXQUFpQixRQUFRO0lBVXZCOztPQUVHO0lBQ0gsU0FBZ0IsU0FBUztRQUt2QixJQUFJLE1BQU0sR0FBc0MsSUFBQSxTQUFFLEdBQUUsQ0FBQztRQUVyRCxPQUFPLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxFQUFFO1lBQzFCLE1BQU0sVUFBVSxHQUFHLENBQUMsUUFBVyxFQUFFLE9BQW1DLEVBQUUsRUFBRTtnQkFDdEUsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDO2dCQUN4QixNQUFNLEdBQUcsSUFBQSxhQUFNLEVBQ2IsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFBLDBCQUFjLEdBQUUsQ0FBQyxFQUMvQixJQUFJLGlCQUFVLENBQXdCLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUN0RixDQUFDLElBQUksQ0FBQyxJQUFBLHVCQUFXLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFdkIsT0FBTyxNQUFNLENBQUM7WUFDaEIsQ0FBQyxDQUFDO1lBRUYsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRTtnQkFDL0IsY0FBYyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDO2FBQ25FLENBQUMs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QUMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUU1QixPQUFPLEdBQUcsQ0FBQztZQUNiLENBQUMsQ0FBQztZQUVGLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMzRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBeEJlLGdCQUFPLFVBd0J0QixDQUFBO0FBQ0gsQ0FBQyxFQTFIZ0IsUUFBUSxHQUFSLGdCQUFRLEtBQVIsZ0JBQVEsUUEwSHhCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBzdGFibGVTdHJpbmdpZnkgZnJvbSAnZmFzdC1qc29uLXN0YWJsZS1zdHJpbmdpZnknO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3ViamVjdCwgY29uY2F0LCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgZmluYWxpemUsIGlnbm9yZUVsZW1lbnRzLCBzaGFyZSwgc2hhcmVSZXBsYXksIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IEpzb25WYWx1ZSB9IGZyb20gJy4uLy4uL2pzb24nO1xuaW1wb3J0IHtcbiAgSm9iRGVzY3JpcHRpb24sXG4gIEpvYkhhbmRsZXIsXG4gIEpvYkhhbmRsZXJDb250ZXh0LFxuICBKb2JJbmJvdW5kTWVzc2FnZSxcbiAgSm9iT3V0Ym91bmRNZXNzYWdlLFxuICBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLFxufSBmcm9tICcuL2FwaSc7XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbmFtZXNwYWNlXG5leHBvcnQgbmFtZXNwYWNlIHN0cmF0ZWd5IHtcbiAgZXhwb3J0IHR5cGUgSm9iU3RyYXRlZ3k8XG4gICAgQSBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgICBJIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIE8gZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gID4gPSAoXG4gICAgaGFuZGxlcjogSm9iSGFuZGxlcjxBLCBJLCBPPixcbiAgICBvcHRpb25zPzogUGFydGlhbDxSZWFkb25seTxKb2JEZXNjcmlwdGlvbj4+LFxuICApID0+IEpvYkhhbmRsZXI8QSwgSSwgTz47XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBKb2JTdHJhdGVneSB0aGF0IHNlcmlhbGl6ZXMgZXZlcnkgY2FsbC4gVGhpcyBzdHJhdGVneSBjYW4gYmUgbWl4ZWQgYmV0d2VlbiBqb2JzLlxuICAgKi9cbiAgZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZTxcbiAgICBBIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIEkgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgTyBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgPigpOiBKb2JTdHJhdGVneTxBLCBJLCBPPiB7XG4gICAgbGV0IGxhdGVzdDogT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+ID0gb2YoKTtcblxuICAgIHJldHVybiAoaGFuZGxlciwgb3B0aW9ucykgPT4ge1xuICAgICAgY29uc3QgbmV3SGFuZGxlciA9IChhcmd1bWVudDogQSwgY29udGV4dDogSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4pID0+IHtcbiAgICAgICAgY29uc3QgcHJldmlvdXMgPSBsYXRlc3Q7XG4gICAgICAgIGxhdGVzdCA9IGNvbmNhdChcbiAgICAgICAgICBwcmV2aW91cy5waXBlKGlnbm9yZUVsZW1lbnRzKCkpLFxuICAgICAgICAgIG5ldyBPYnNlcnZhYmxlPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4oKG8pID0+IGhhbmRsZXIoYXJndW1lbnQsIGNvbnRleHQpLnN1YnNjcmliZShvKSksXG4gICAgICAgICkucGlwZShzaGFyZVJlcGxheSgwKSk7XG5cbiAgICAgICAgcmV0dXJuIGxhdGVzdDtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKG5ld0hhbmRsZXIsIHtcbiAgICAgICAgam9iRGVzY3JpcHRpb246IE9iamVjdC5hc3NpZ24oe30sIGhhbmRsZXIuam9iRGVzY3JpcHRpb24sIG9wdGlvbnMpLFxuICAgICAgfSk7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgSm9iU3RyYXRlZ3kgdGhhdCB3aWxsIGFsd2F5cyByZXVzZSBhIHJ1bm5pbmcgam9iLCBhbmQgcmVzdGFydCBpdCBpZiB0aGUgam9iIGVuZGVkLlxuICAgKiBAcGFyYW0gcmVwbGF5TWVzc2FnZXMgUmVwbGF5IEFMTCBtZXNzYWdlcyBpZiBhIGpvYiBpcyByZXVzZWQsIG90aGVyd2lzZSBqdXN0IGhvb2sgdXAgd2hlcmUgaXRcbiAgICogICAgICAgIGlzLlxuICAgKi9cbiAgZXhwb3J0IGZ1bmN0aW9uIHJldXNlPFxuICAgIEEgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gICAgSSBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgICBPIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICA+KHJlcGxheU1lc3NhZ2VzID0gZmFsc2UpOiBKb2JTdHJhdGVneTxBLCBJLCBPPiB7XG4gICAgbGV0IGluYm91bmRCdXMgPSBuZXcgU3ViamVjdDxKb2JJbmJvdW5kTWVzc2FnZTxJPj4oKTtcbiAgICBsZXQgcnVuOiBPYnNlcnZhYmxlPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4gfCBudWxsID0gbnVsbDtcbiAgICBsZXQgc3RhdGU6IEpvYk91dGJvdW5kTWVzc2FnZTxPPiB8IG51bGwgPSBudWxsO1xuXG4gICAgcmV0dXJuIChoYW5kbGVyLCBvcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCBuZXdIYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgICAgICAvLyBGb3J3YXJkIGlucHV0cy5cbiAgICAgICAgY29uc3Qgc3Vic2NyaXB0aW9uID0gY29udGV4dC5pbmJvdW5kQnVzLnN1YnNjcmliZShpbmJvdW5kQnVzKTtcblxuICAgICAgICBpZiAocnVuKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbmNhdChcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBzdGF0ZS5cbiAgICAgICAgICAgIG9mKHN0YXRlKSxcbiAgICAgICAgICAgIHJ1bixcbiAgICAgICAgICApLnBpcGUoZmluYWxpemUoKCkgPT4gc3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCkpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJ1biA9IGhhbmRsZXIoYXJndW1lbnQsIHsgLi4uY29udGV4dCwgaW5ib3VuZEJ1czogaW5ib3VuZEJ1cy5hc09ic2VydmFibGUoKSB9KS5waXBlKFxuICAgICAgICAgIHRhcChcbiAgICAgICAgICAgIChtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmtpbmQgPT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5TdGFydCB8fFxuICAgICAgICAgICAgICAgIG1lc3NhZ2Uua2luZCA9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk9uUmVhZHkgfHxcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmtpbmQgPT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5FbmRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBtZXNzYWdlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICBzdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgICAgICAgICAgaW5ib3VuZEJ1cyA9IG5ldyBTdWJqZWN0PEpvYkluYm91bmRNZXNzYWdlPEk+PigpO1xuICAgICAgICAgICAgICBydW4gPSBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICApLFxuICAgICAgICAgIHJlcGxheU1lc3NhZ2VzID8gc2hhcmVSZXBsYXkoKSA6IHNoYXJlKCksXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHJ1bjtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKG5ld0hhbmRsZXIsIGhhbmRsZXIsIG9wdGlvbnMgfHwge30pO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEpvYlN0cmF0ZWd5IHRoYXQgd2lsbCByZXVzZSBhIHJ1bm5pbmcgam9iIGlmIHRoZSBhcmd1bWVudCBtYXRjaGVzLlxuICAgKiBAcGFyYW0gcmVwbGF5TWVzc2FnZXMgUmVwbGF5IEFMTCBtZXNzYWdlcyBpZiBhIGpvYiBpcyByZXVzZWQsIG90aGVyd2lzZSBqdXN0IGhvb2sgdXAgd2hlcmUgaXRcbiAgICogICAgICAgIGlzLlxuICAgKi9cbiAgZXhwb3J0IGZ1bmN0aW9uIG1lbW9pemU8XG4gICAgQSBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgICBJIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICAgIE8gZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gID4ocmVwbGF5TWVzc2FnZXMgPSBmYWxzZSk6IEpvYlN0cmF0ZWd5PEEsIEksIE8+IHtcbiAgICBjb25zdCBydW5zID0gbmV3IE1hcDxzdHJpbmcsIE9ic2VydmFibGU8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+Pj4oKTtcblxuICAgIHJldHVybiAoaGFuZGxlciwgb3B0aW9ucykgPT4ge1xuICAgICAgY29uc3QgbmV3SGFuZGxlciA9IChhcmd1bWVudDogQSwgY29udGV4dDogSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4pID0+IHtcbiAgICAgICAgY29uc3QgYXJndW1lbnRKc29uID0gc3RhYmxlU3RyaW5naWZ5KGFyZ3VtZW50KTtcbiAgICAgICAgY29uc3QgbWF5YmVKb2IgPSBydW5zLmdldChhcmd1bWVudEpzb24pO1xuXG4gICAgICAgIGlmIChtYXliZUpvYikge1xuICAgICAgICAgIHJldHVybiBtYXliZUpvYjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJ1biA9IGhhbmRsZXIoYXJndW1lbnQsIGNvbnRleHQpLnBpcGUocmVwbGF5TWVzc2FnZXMgPyBzaGFyZVJlcGxheSgpIDogc2hhcmUoKSk7XG4gICAgICAgIHJ1bnMuc2V0KGFyZ3VtZW50SnNvbiwgcnVuKTtcblxuICAgICAgICByZXR1cm4gcnVuO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24obmV3SGFuZGxlciwgaGFuZGxlciwgb3B0aW9ucyB8fCB7fSk7XG4gICAgfTtcbiAgfVxufVxuIl19