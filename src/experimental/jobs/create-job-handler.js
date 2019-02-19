"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 */
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const index_1 = require("../../exception/index");
const index_2 = require("../../utils/index");
const api_1 = require("./api");
class ChannelAlreadyExistException extends index_1.BaseException {
    constructor(name) {
        super(`Channel ${JSON.stringify(name)} already exist.`);
    }
}
exports.ChannelAlreadyExistException = ChannelAlreadyExistException;
/**
 * Make a simple job handler that sets start and end from a function that's synchronous.
 *
 * @param fn The function to create a handler for.
 * @param options An optional set of properties to set on the handler. Some fields might be
 *   required by registry or schedulers.
 */
function createJobHandler(fn, options = {}) {
    const handler = (argument, context) => {
        const description = context.description;
        const inboundBus = context.inboundBus;
        const inputChannel = new rxjs_1.Subject();
        let subscription;
        return new rxjs_1.Observable(subject => {
            function complete() {
                if (subscription) {
                    subscription.unsubscribe();
                }
                subject.next({ kind: api_1.JobOutboundMessageKind.End, description });
                subject.complete();
                inputChannel.complete();
            }
            // Handle input.
            const inboundSub = inboundBus.subscribe(message => {
                switch (message.kind) {
                    case api_1.JobInboundMessageKind.Ping:
                        subject.next({ kind: api_1.JobOutboundMessageKind.Pong, description, id: message.id });
                        break;
                    case api_1.JobInboundMessageKind.Stop:
                        // There's no way to cancel a promise or a synchronous function, but we do cancel
                        // observables where possible.
                        complete();
                        break;
                    case api_1.JobInboundMessageKind.Input:
                        inputChannel.next(message.value);
                        break;
                }
            });
            // Execute the function with the additional context.
            const channels = new Map();
            const newContext = Object.assign({}, context, { input: inputChannel.asObservable(), createChannel(name) {
                    if (channels.has(name)) {
                        throw new ChannelAlreadyExistException(name);
                    }
                    const channelSubject = new rxjs_1.Subject();
                    const channelSub = channelSubject.subscribe(message => {
                        subject.next({
                            kind: api_1.JobOutboundMessageKind.ChannelMessage, description, name, message,
                        });
                    }, error => {
                        subject.next({ kind: api_1.JobOutboundMessageKind.ChannelError, description, name, error });
                        // This can be reopened.
                        channels.delete(name);
                    }, () => {
                        subject.next({ kind: api_1.JobOutboundMessageKind.ChannelComplete, description, name });
                        // This can be reopened.
                        channels.delete(name);
                    });
                    channels.set(name, channelSubject);
                    if (subscription) {
                        subscription.add(channelSub);
                    }
                    return channelSubject;
                } });
            subject.next({ kind: api_1.JobOutboundMessageKind.Start, description });
            let result = fn(argument, newContext);
            // If the result is a promise, simply wait for it to complete before reporting the result.
            if (index_2.isPromise(result)) {
                result = rxjs_1.from(result);
            }
            else if (!rxjs_1.isObservable(result)) {
                result = rxjs_1.of(result);
            }
            subscription = result.subscribe((value) => subject.next({ kind: api_1.JobOutboundMessageKind.Output, description, value }), error => subject.error(error), () => complete());
            subscription.add(inboundSub);
            return subscription;
        });
    };
    return Object.assign(handler, { jobDescription: options });
}
exports.createJobHandler = createJobHandler;
/**
 * Lazily create a job using a function.
 * @param loader A factory function that returns a promise/observable of a JobHandler.
 * @param options Same options as createJob.
 */
function createJobFactory(loader, options = {}) {
    const handler = (argument, context) => {
        return rxjs_1.from(loader())
            .pipe(operators_1.switchMap(fn => fn(argument, context)));
    };
    return Object.assign(handler, { jobDescription: options });
}
exports.createJobFactory = createJobFactory;
/**
 * Creates a job that logs out input/output messages of another Job. The messages are still
 * propagated to the other job.
 */
function createLoggerJob(job, logger) {
    const handler = (argument, context) => {
        context.inboundBus.pipe(operators_1.tap(message => logger.info(`Input: ${JSON.stringify(message)}`))).subscribe();
        return job(argument, context).pipe(operators_1.tap(message => logger.info(`Message: ${JSON.stringify(message)}`), error => logger.warn(`Error: ${JSON.stringify(error)}`), () => logger.info(`Completed`)));
    };
    return Object.assign(handler, job);
}
exports.createLoggerJob = createLoggerJob;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWpvYi1oYW5kbGVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9leHBlcmltZW50YWwvam9icy9jcmVhdGUtam9iLWhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7OztHQU9HO0FBQ0gsK0JBQTJGO0FBQzNGLDhDQUFnRDtBQUNoRCxpREFBc0Q7QUFHdEQsNkNBQThDO0FBQzlDLCtCQU9lO0FBR2YsTUFBYSw0QkFBNkIsU0FBUSxxQkFBYTtJQUM3RCxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLFdBQVcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUMxRCxDQUFDO0NBQ0Y7QUFKRCxvRUFJQztBQTJCRDs7Ozs7O0dBTUc7QUFDSCxTQUFnQixnQkFBZ0IsQ0FDOUIsRUFBK0IsRUFDL0IsVUFBbUMsRUFBRTtJQUVyQyxNQUFNLE9BQU8sR0FBRyxDQUFDLFFBQVcsRUFBRSxPQUFtQyxFQUFFLEVBQUU7UUFDbkUsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUN4QyxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO1FBQ3RDLE1BQU0sWUFBWSxHQUFHLElBQUksY0FBTyxFQUFLLENBQUM7UUFDdEMsSUFBSSxZQUEwQixDQUFDO1FBRS9CLE9BQU8sSUFBSSxpQkFBVSxDQUF3QixPQUFPLENBQUMsRUFBRTtZQUNyRCxTQUFTLFFBQVE7Z0JBQ2YsSUFBSSxZQUFZLEVBQUU7b0JBQ2hCLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQztpQkFDNUI7Z0JBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSw0QkFBc0IsQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztnQkFDaEUsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNuQixZQUFZLENB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RUFBRTtRQUNuRSxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FDckIsZUFBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQ2pFLENBQUMsU0FBUyxFQUFFLENBQUM7UUFFZCxPQUFPLEdBQUcsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUNoQyxlQUFHLENBQ0QsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQzdELEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUN2RCxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUMvQixDQUNGLENBQUM7SUFDSixDQUFDLENBQUM7SUFFRixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3JDLENBQUM7QUFuQkQsMENBbUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKi9cbmltcG9ydCB7IE9ic2VydmFibGUsIE9ic2VydmVyLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZyb20sIGlzT2JzZXJ2YWJsZSwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IHN3aXRjaE1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uLy4uL2V4Y2VwdGlvbi9pbmRleCc7XG5pbXBvcnQgeyBKc29uVmFsdWUgfSBmcm9tICcuLi8uLi9qc29uL2luZGV4JztcbmltcG9ydCB7IExvZ2dlckFwaSB9IGZyb20gJy4uLy4uL2xvZ2dlcic7XG5pbXBvcnQgeyBpc1Byb21pc2UgfSBmcm9tICcuLi8uLi91dGlscy9pbmRleCc7XG5pbXBvcnQge1xuICBKb2JEZXNjcmlwdGlvbixcbiAgSm9iSGFuZGxlcixcbiAgSm9iSGFuZGxlckNvbnRleHQsXG4gIEpvYkluYm91bmRNZXNzYWdlS2luZCxcbiAgSm9iT3V0Ym91bmRNZXNzYWdlLFxuICBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLFxufSBmcm9tICcuL2FwaSc7XG5cblxuZXhwb3J0IGNsYXNzIENoYW5uZWxBbHJlYWR5RXhpc3RFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoYENoYW5uZWwgJHtKU09OLnN0cmluZ2lmeShuYW1lKX0gYWxyZWFkeSBleGlzdC5gKTtcbiAgfVxufVxuXG4vKipcbiAqIEludGVyZmFjZSBmb3IgdGhlIEpvYkhhbmRsZXIgY29udGV4dCB0aGF0IGlzIHVzZWQgd2hlbiB1c2luZyBgY3JlYXRlSm9iSGFuZGxlcigpYC4gSXQgZXh0ZW5kc1xuICogdGhlIGJhc2ljIGBKb2JIYW5kbGVyQ29udGV4dGAgd2l0aCBhZGRpdGlvbmFsIGZ1bmN0aW9uYWxpdHkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2ltcGxlSm9iSGFuZGxlckNvbnRleHQ8XG4gIEEgZXh0ZW5kcyBKc29uVmFsdWUsXG4gIEkgZXh0ZW5kcyBKc29uVmFsdWUsXG4gIE8gZXh0ZW5kcyBKc29uVmFsdWUsXG4+IGV4dGVuZHMgSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4ge1xuICBjcmVhdGVDaGFubmVsOiAobmFtZTogc3RyaW5nKSA9PiBPYnNlcnZlcjxKc29uVmFsdWU+O1xuICBpbnB1dDogT2JzZXJ2YWJsZTxJPjtcbn1cblxuXG4vKipcbiAqIEEgc2ltcGxlIHZlcnNpb24gb2YgdGhlIEpvYkhhbmRsZXIuIFRoaXMgc2ltcGxpZmllcyBhIGxvdCBvZiB0aGUgaW50ZXJhY3Rpb24gd2l0aCB0aGUgam9iXG4gKiBzY2hlZHVsZXIgYW5kIHJlZ2lzdHJ5LiBGb3IgZXhhbXBsZSwgaW5zdGVhZCBvZiByZXR1cm5pbmcgYSBKb2JPdXRib3VuZE1lc3NhZ2Ugb2JzZXJ2YWJsZSwgeW91XG4gKiBjYW4gZGlyZWN0bHkgcmV0dXJuIGFuIG91dHB1dC5cbiAqL1xuZXhwb3J0IHR5cGUgU2ltcGxlSm9iSGFuZGxlckZuPEEgZXh0ZW5kcyBKc29uVmFsdWUsIEkgZXh0ZW5kcyBKc29uVmFsdWUsIE8gZXh0ZW5kcyBKc29uVmFsdWU+ID0gKFxuICBpbnB1dDogQSxcbiAgY29udGV4dDogU2ltcGxlSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4sXG4pID0+IE8gfCBQcm9taXNlPE8+IHwgT2JzZXJ2YWJsZTxPPjtcblxuXG4vKipcbiAqIE1ha2UgYSBzaW1wbGUgam9iIGhhbmRsZXIgdGhhdCBzZXRzIHN0YXJ0IGFuZCBlbmQgZnJvbSBhIGZ1bmN0aW9uIHRoYXQncyBzeW5jaHJvbm91cy5cbiAqXG4gKiBAcGFyYW0gZm4gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSBhIGhhbmRsZXIgZm9yLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb3B0aW9uYWwgc2V0IG9mIHByb3BlcnRpZXMgdG8gc2V0IG9uIHRoZSBoYW5kbGVyLiBTb21lIGZpZWxkcyBtaWdodCBiZVxuICogICByZXF1aXJlZCBieSByZWdpc3RyeSBvciBzY2hlZHVsZXJzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSm9iSGFuZGxlcjxBIGV4dGVuZHMgSnNvblZhbHVlLCBJIGV4dGVuZHMgSnNvblZhbHVlLCBPIGV4dGVuZHMgSnNvblZhbHVlPihcbiAgZm46IFNpbXBsZUpvYkhhbmRsZXJGbjxBLCBJLCBPPixcbiAgb3B0aW9uczogUGFydGlhbDxKb2JEZXNjcmlwdGlvbj4gPSB7fSxcbik6IEpvYkhhbmRsZXI8QSwgSSwgTz4ge1xuICBjb25zdCBoYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gY29udGV4dC5kZXNjcmlwdGlvbjtcbiAgICBjb25zdCBpbmJvdW5kQnVzID0gY29udGV4dC5pbmJvdW5kQnVzO1xuICAgIGNvbnN0IGlucHV0Q2hhbm5lbCA9IG5ldyBTdWJqZWN0PEk+KCk7XG4gICAgbGV0IHN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xuXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4oc3ViamVjdCA9PiB7XG4gICAgICBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcbiAgICAgICAgaWYgKHN1YnNjcmlwdGlvbikge1xuICAgICAgICAgIHN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgICAgICB9XG4gICAgICAgIHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuRW5kLCBkZXNjcmlwdGlvbiB9KTtcbiAgICAgICAgc3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICBpbnB1dENoYW5uZWwuY29tcGxldGUoKTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIGlucHV0LlxuICAgICAgY29uc3QgaW5ib3VuZFN1YiA9IGluYm91bmRCdXMuc3Vic2NyaWJlKG1lc3NhZ2UgPT4ge1xuICAgICAgICBzd2l0Y2ggKG1lc3NhZ2Uua2luZCkge1xuICAgICAgICAgIGNhc2UgSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLlBpbmc6XG4gICAgICAgICAgICBzdWJqZWN0Lm5leHQoeyBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlBvbmcsIGRlc2NyaXB0aW9uLCBpZDogbWVzc2FnZS5pZCB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSBKb2JJbmJvdW5kTWVzc2FnZUtpbmQuU3RvcDpcbiAgICAgICAgICAgIC8vIFRoZXJlJ3Mgbm8gd2F5IHRvIGNhbmNlbCBhIHByb21pc2Ugb3IgYSBzeW5jaHJvbm91cyBmdW5jdGlvbiwgYnV0IHdlIGRvIGNhbmNlbFxuICAgICAgICAgICAgLy8gb2JzZXJ2YWJsZXMgd2hlcmUgcG9zc2libGUuXG4gICAgICAgICAgICBjb21wbGV0ZSgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIEpvYkluYm91bmRNZXNzYWdlS2luZC5JbnB1dDpcbiAgICAgICAgICAgIGlucHV0Q2hhbm5lbC5uZXh0KG1lc3NhZ2UudmFsdWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBFeGVjdXRlIHRoZSBmdW5jdGlvbiB3aXRoIHRoZSBhZGRpdGlvbmFsIGNvbnRleHQuXG4gICAgICBjb25zdCBjaGFubmVscyA9IG5ldyBNYXA8c3RyaW5nLCBTdWJqZWN0PEpzb25WYWx1ZT4+KCk7XG5cbiAgICAgIGNvbnN0IG5ld0NvbnRleHQ6IFNpbXBsZUpvYkhhbmRsZXJDb250ZXh0PEEsIEksIE8+ID0ge1xuICAgICAgICAuLi5jb250ZXh0LFxuICAgICAgICBpbnB1dDogaW5wdXRDaGFubmVsLmFzT2JzZXJ2YWJsZSgpLFxuICAgICAgICBjcmVhdGVDaGFubmVsKG5hbWU6IHN0cmluZykge1xuICAgICAgICAgIGlmIChjaGFubmVscy5oYXMobmFtZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBDaGFubmVsQWxyZWFkeUV4aXN0RXhjZXB0aW9uKG5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBjaGFubmVsU3ViamVjdCA9IG5ldyBTdWJqZWN0PEpzb25WYWx1ZT4oKTtcbiAgICAgICAgICBjb25zdCBjaGFubmVsU3ViID0gY2hhbm5lbFN1YmplY3Quc3Vic2NyaWJlKFxuICAgICAgICAgICAgbWVzc2FnZSA9PiB7XG4gICAgICAgICAgICAgIHN1YmplY3QubmV4dCh7XG4gICAgICAgICAgICAgICAga2luZDogSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5DaGFubmVsTWVzc2FnZSwgZGVzY3JpcHRpb24sIG5hbWUsIG1lc3NhZ2UsXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgc3ViamVjdC5uZXh0KHsga2luZDogSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5DaGFubmVsRXJyb3IsIGRlc2NyaXB0aW9uLCBuYW1lLCBlcnJvciB9KTtcbiAgICAgICAgICAgICAgLy8gVGhpcyBjYW4gYmUgcmVvcGVuZWQuXG4gICAgICAgICAgICAgIGNoYW5uZWxzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgIHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbENvbXBsZXRlLCBkZXNjcmlwdGlvbiwgbmFtZSB9KTtcbiAgICAgICAgICAgICAgLy8gVGhpcyBjYW4gYmUgcmVvcGVuZWQuXG4gICAgICAgICAgICAgIGNoYW5uZWxzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGNoYW5uZWxzLnNldChuYW1lLCBjaGFubmVsU3ViamVjdCk7XG4gICAgICAgICAgaWYgKHN1YnNjcmlwdGlvbikge1xuICAgICAgICAgICAgc3Vic2NyaXB0aW9uLmFkZChjaGFubmVsU3ViKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gY2hhbm5lbFN1YmplY3Q7XG4gICAgICAgIH0sXG4gICAgICB9O1xuXG4gICAgICBzdWJqZWN0Lm5leHQoeyBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlN0YXJ0LCBkZXNjcmlwdGlvbiB9KTtcbiAgICAgIGxldCByZXN1bHQgPSBmbihhcmd1bWVudCwgbmV3Q29udGV4dCk7XG4gICAgICAvLyBJZiB0aGUgcmVzdWx0IGlzIGEgcHJvbWlzZSwgc2ltcGx5IHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSByZXBvcnRpbmcgdGhlIHJlc3VsdC5cbiAgICAgIGlmIChpc1Byb21pc2UocmVzdWx0KSkge1xuICAgICAgICByZXN1bHQgPSBmcm9tKHJlc3VsdCk7XG4gICAgICB9IGVsc2UgaWYgKCFpc09ic2VydmFibGUocmVzdWx0KSkge1xuICAgICAgICByZXN1bHQgPSBvZihyZXN1bHQgYXMgTyk7XG4gICAgICB9XG5cbiAgICAgIHN1YnNjcmlwdGlvbiA9IChyZXN1bHQgYXMgT2JzZXJ2YWJsZTxPPikuc3Vic2NyaWJlKFxuICAgICAgICAodmFsdWU6IE8pID0+IHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuT3V0cHV0LCBkZXNjcmlwdGlvbiwgdmFsdWUgfSksXG4gICAgICAgIGVycm9yID0+IHN1YmplY3QuZXJyb3IoZXJyb3IpLFxuICAgICAgICAoKSA9PiBjb21wbGV0ZSgpLFxuICAgICAgKTtcbiAgICAgIHN1YnNjcmlwdGlvbi5hZGQoaW5ib3VuZFN1Yik7XG5cbiAgICAgIHJldHVybiBzdWJzY3JpcHRpb247XG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oaGFuZGxlciwgeyBqb2JEZXNjcmlwdGlvbjogb3B0aW9ucyB9KTtcbn1cblxuXG4vKipcbiAqIExhemlseSBjcmVhdGUgYSBqb2IgdXNpbmcgYSBmdW5jdGlvbi5cbiAqIEBwYXJhbSBsb2FkZXIgQSBmYWN0b3J5IGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHByb21pc2Uvb2JzZXJ2YWJsZSBvZiBhIEpvYkhhbmRsZXIuXG4gKiBAcGFyYW0gb3B0aW9ucyBTYW1lIG9wdGlvbnMgYXMgY3JlYXRlSm9iLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSm9iRmFjdG9yeTxBIGV4dGVuZHMgSnNvblZhbHVlLCBJIGV4dGVuZHMgSnNvblZhbHVlLCBPIGV4dGVuZHMgSnNvblZhbHVlPihcbiAgbG9hZGVyOiAoKSA9PiBQcm9taXNlPEpvYkhhbmRsZXI8QSwgSSwgTz4+LFxuICBvcHRpb25zOiBQYXJ0aWFsPEpvYkRlc2NyaXB0aW9uPiA9IHt9LFxuKTogSm9iSGFuZGxlcjxBLCBJLCBPPiB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoYXJndW1lbnQ6IEEsIGNvbnRleHQ6IEpvYkhhbmRsZXJDb250ZXh0PEEsIEksIE8+KSA9PiB7XG4gICAgcmV0dXJuIGZyb20obG9hZGVyKCkpXG4gICAgICAucGlwZShzd2l0Y2hNYXAoZm4gPT4gZm4oYXJndW1lbnQsIGNvbnRleHQpKSk7XG4gIH07XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oaGFuZGxlciwgeyBqb2JEZXNjcmlwdGlvbjogb3B0aW9ucyB9KTtcbn1cblxuXG4vKipcbiAqIENyZWF0ZXMgYSBqb2IgdGhhdCBsb2dzIG91dCBpbnB1dC9vdXRwdXQgbWVzc2FnZXMgb2YgYW5vdGhlciBKb2IuIFRoZSBtZXNzYWdlcyBhcmUgc3RpbGxcbiAqIHByb3BhZ2F0ZWQgdG8gdGhlIG90aGVyIGpvYi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvZ2dlckpvYjxBIGV4dGVuZHMgSnNvblZhbHVlLCBJIGV4dGVuZHMgSnNvblZhbHVlLCBPIGV4dGVuZHMgSnNvblZhbHVlPihcbiAgam9iOiBKb2JIYW5kbGVyPEEsIEksIE8+LFxuICBsb2dnZXI6IExvZ2dlckFwaSxcbik6IEpvYkhhbmRsZXI8QSwgSSwgTz4ge1xuICBjb25zdCBoYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgIGNvbnRleHQuaW5ib3VuZEJ1cy5waXBlKFxuICAgICAgdGFwKG1lc3NhZ2UgPT4gbG9nZ2VyLmluZm8oYElucHV0OiAke0pTT04uc3RyaW5naWZ5KG1lc3NhZ2UpfWApKSxcbiAgICApLnN1YnNjcmliZSgpO1xuXG4gICAgcmV0dXJuIGpvYihhcmd1bWVudCwgY29udGV4dCkucGlwZShcbiAgICAgIHRhcChcbiAgICAgICAgbWVzc2FnZSA9PiBsb2dnZXIuaW5mbyhgTWVzc2FnZTogJHtKU09OLnN0cmluZ2lmeShtZXNzYWdlKX1gKSxcbiAgICAgICAgZXJyb3IgPT4gbG9nZ2VyLndhcm4oYEVycm9yOiAke0pTT04uc3RyaW5naWZ5KGVycm9yKX1gKSxcbiAgICAgICAgKCkgPT4gbG9nZ2VyLmluZm8oYENvbXBsZXRlZGApLFxuICAgICAgKSxcbiAgICApO1xuICB9O1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKGhhbmRsZXIsIGpvYik7XG59XG4iXX0=