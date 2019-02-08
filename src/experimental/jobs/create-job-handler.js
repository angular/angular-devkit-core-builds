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
const index_2 = require("../../logger/index");
const index_3 = require("../../utils/index");
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
            // Configure a logger to pass in as additional context.
            const logger = new index_2.Logger('job');
            const logSub = logger.subscribe(entry => {
                subject.next({
                    kind: api_1.JobOutboundMessageKind.Log,
                    description,
                    entry,
                });
            });
            // Execute the function with the additional context.
            const channels = new Map();
            const newContext = Object.assign({}, context, { input: inputChannel.asObservable(), logger,
                createChannel(name) {
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
            if (index_3.isPromise(result)) {
                result = rxjs_1.from(result);
            }
            else if (!rxjs_1.isObservable(result)) {
                result = rxjs_1.of(result);
            }
            subscription = result.subscribe((value) => subject.next({ kind: api_1.JobOutboundMessageKind.Output, description, value }), error => subject.error(error), () => complete());
            subscription.add(inboundSub);
            subscription.add(logSub);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWpvYi1oYW5kbGVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9leHBlcmltZW50YWwvam9icy9jcmVhdGUtam9iLWhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7OztHQU9HO0FBQ0gsK0JBQTJGO0FBQzNGLDhDQUFnRDtBQUNoRCxpREFBc0Q7QUFFdEQsOENBQXVEO0FBQ3ZELDZDQUE4QztBQUM5QywrQkFPZTtBQUdmLE1BQWEsNEJBQTZCLFNBQVEscUJBQWE7SUFDN0QsWUFBWSxJQUFZO1FBQ3RCLEtBQUssQ0FBQyxXQUFXLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDMUQsQ0FBQztDQUNGO0FBSkQsb0VBSUM7QUE0QkQ7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQzlCLEVBQStCLEVBQy9CLFVBQW1DLEVBQUU7SUFFckMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxRQUFXLEVBQUUsT0FBbUMsRUFBRSxFQUFFO1FBQ25FLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUM7UUFDeEMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztRQUN0QyxNQUFNLFlBQVksR0FBRyxJQUFJLGNBQU8sRUFBSyxDQUFDO1FBQ3RDLElBQUksWUFBMEIsQ0FBQztRQUUvQixPQUFPLElBQUksaUJBQVUsQ0FBd0IsT0FBTyxDQUFDLEVBQUU7WUFDckQsU0FBUyxRQUFRO2dCQUNmLElBQUksWUFBWSxFQUFFO29CQUNoQixZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7aUJBQzVCO2dCQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsNEJBQXNCLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7Z0JBQ2hFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztn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KiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKi9cbmltcG9ydCB7IE9ic2VydmFibGUsIE9ic2VydmVyLCBTdWJqZWN0LCBTdWJzY3JpcHRpb24sIGZyb20sIGlzT2JzZXJ2YWJsZSwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IHN3aXRjaE1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uLy4uL2V4Y2VwdGlvbi9pbmRleCc7XG5pbXBvcnQgeyBKc29uVmFsdWUgfSBmcm9tICcuLi8uLi9qc29uL2luZGV4JztcbmltcG9ydCB7IExvZ2dlciwgTG9nZ2VyQXBpIH0gZnJvbSAnLi4vLi4vbG9nZ2VyL2luZGV4JztcbmltcG9ydCB7IGlzUHJvbWlzZSB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4JztcbmltcG9ydCB7XG4gIEpvYkRlc2NyaXB0aW9uLFxuICBKb2JIYW5kbGVyLFxuICBKb2JIYW5kbGVyQ29udGV4dCxcbiAgSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLFxuICBKb2JPdXRib3VuZE1lc3NhZ2UsXG4gIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQsXG59IGZyb20gJy4vYXBpJztcblxuXG5leHBvcnQgY2xhc3MgQ2hhbm5lbEFscmVhZHlFeGlzdEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgQ2hhbm5lbCAke0pTT04uc3RyaW5naWZ5KG5hbWUpfSBhbHJlYWR5IGV4aXN0LmApO1xuICB9XG59XG5cbi8qKlxuICogSW50ZXJmYWNlIGZvciB0aGUgSm9iSGFuZGxlciBjb250ZXh0IHRoYXQgaXMgdXNlZCB3aGVuIHVzaW5nIGBjcmVhdGVKb2JIYW5kbGVyKClgLiBJdCBleHRlbmRzXG4gKiB0aGUgYmFzaWMgYEpvYkhhbmRsZXJDb250ZXh0YCB3aXRoIGFkZGl0aW9uYWwgZnVuY3Rpb25hbGl0eS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTaW1wbGVKb2JIYW5kbGVyQ29udGV4dDxcbiAgQSBleHRlbmRzIEpzb25WYWx1ZSxcbiAgSSBleHRlbmRzIEpzb25WYWx1ZSxcbiAgTyBleHRlbmRzIEpzb25WYWx1ZSxcbj4gZXh0ZW5kcyBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPiB7XG4gIGxvZ2dlcjogTG9nZ2VyQXBpO1xuICBjcmVhdGVDaGFubmVsOiAobmFtZTogc3RyaW5nKSA9PiBPYnNlcnZlcjxKc29uVmFsdWU+O1xuICBpbnB1dDogT2JzZXJ2YWJsZTxJPjtcbn1cblxuXG4vKipcbiAqIEEgc2ltcGxlIHZlcnNpb24gb2YgdGhlIEpvYkhhbmRsZXIuIFRoaXMgc2ltcGxpZmllcyBhIGxvdCBvZiB0aGUgaW50ZXJhY3Rpb24gd2l0aCB0aGUgam9iXG4gKiBzY2hlZHVsZXIgYW5kIHJlZ2lzdHJ5LiBGb3IgZXhhbXBsZSwgaW5zdGVhZCBvZiByZXR1cm5pbmcgYSBKb2JPdXRib3VuZE1lc3NhZ2Ugb2JzZXJ2YWJsZSwgeW91XG4gKiBjYW4gZGlyZWN0bHkgcmV0dXJuIGFuIG91dHB1dC5cbiAqL1xuZXhwb3J0IHR5cGUgU2ltcGxlSm9iSGFuZGxlckZuPEEgZXh0ZW5kcyBKc29uVmFsdWUsIEkgZXh0ZW5kcyBKc29uVmFsdWUsIE8gZXh0ZW5kcyBKc29uVmFsdWU+ID0gKFxuICBpbnB1dDogQSxcbiAgY29udGV4dDogU2ltcGxlSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4sXG4pID0+IE8gfCBQcm9taXNlPE8+IHwgT2JzZXJ2YWJsZTxPPjtcblxuXG4vKipcbiAqIE1ha2UgYSBzaW1wbGUgam9iIGhhbmRsZXIgdGhhdCBzZXRzIHN0YXJ0IGFuZCBlbmQgZnJvbSBhIGZ1bmN0aW9uIHRoYXQncyBzeW5jaHJvbm91cy5cbiAqXG4gKiBAcGFyYW0gZm4gVGhlIGZ1bmN0aW9uIHRvIGNyZWF0ZSBhIGhhbmRsZXIgZm9yLlxuICogQHBhcmFtIG9wdGlvbnMgQW4gb3B0aW9uYWwgc2V0IG9mIHByb3BlcnRpZXMgdG8gc2V0IG9uIHRoZSBoYW5kbGVyLiBTb21lIGZpZWxkcyBtaWdodCBiZVxuICogICByZXF1aXJlZCBieSByZWdpc3RyeSBvciBzY2hlZHVsZXJzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSm9iSGFuZGxlcjxBIGV4dGVuZHMgSnNvblZhbHVlLCBJIGV4dGVuZHMgSnNvblZhbHVlLCBPIGV4dGVuZHMgSnNvblZhbHVlPihcbiAgZm46IFNpbXBsZUpvYkhhbmRsZXJGbjxBLCBJLCBPPixcbiAgb3B0aW9uczogUGFydGlhbDxKb2JEZXNjcmlwdGlvbj4gPSB7fSxcbik6IEpvYkhhbmRsZXI8QSwgSSwgTz4ge1xuICBjb25zdCBoYW5kbGVyID0gKGFyZ3VtZW50OiBBLCBjb250ZXh0OiBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPikgPT4ge1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gY29udGV4dC5kZXNjcmlwdGlvbjtcbiAgICBjb25zdCBpbmJvdW5kQnVzID0gY29udGV4dC5pbmJvdW5kQnVzO1xuICAgIGNvbnN0IGlucHV0Q2hhbm5lbCA9IG5ldyBTdWJqZWN0PEk+KCk7XG4gICAgbGV0IHN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xuXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4oc3ViamVjdCA9PiB7XG4gICAgICBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcbiAgICAgICAgaWYgKHN1YnNjcmlwdGlvbikge1xuICAgICAgICAgIHN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgICAgICB9XG4gICAgICAgIHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuRW5kLCBkZXNjcmlwdGlvbiB9KTtcbiAgICAgICAgc3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICBpbnB1dENoYW5uZWwuY29tcGxldGUoKTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIGlucHV0LlxuICAgICAgY29uc3QgaW5ib3VuZFN1YiA9IGluYm91bmRCdXMuc3Vic2NyaWJlKG1lc3NhZ2UgPT4ge1xuICAgICAgICBzd2l0Y2ggKG1lc3NhZ2Uua2luZCkge1xuICAgICAgICAgIGNhc2UgSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLlBpbmc6XG4gICAgICAgICAgICBzdWJqZWN0Lm5leHQoeyBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlBvbmcsIGRlc2NyaXB0aW9uLCBpZDogbWVzc2FnZS5pZCB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSBKb2JJbmJvdW5kTWVzc2FnZUtpbmQuU3RvcDpcbiAgICAgICAgICAgIC8vIFRoZXJlJ3Mgbm8gd2F5IHRvIGNhbmNlbCBhIHByb21pc2Ugb3IgYSBzeW5jaHJvbm91cyBmdW5jdGlvbiwgYnV0IHdlIGRvIGNhbmNlbFxuICAgICAgICAgICAgLy8gb2JzZXJ2YWJsZXMgd2hlcmUgcG9zc2libGUuXG4gICAgICAgICAgICBjb21wbGV0ZSgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIEpvYkluYm91bmRNZXNzYWdlS2luZC5JbnB1dDpcbiAgICAgICAgICAgIGlucHV0Q2hhbm5lbC5uZXh0KG1lc3NhZ2UudmFsdWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBDb25maWd1cmUgYSBsb2dnZXIgdG8gcGFzcyBpbiBhcyBhZGRpdGlvbmFsIGNvbnRleHQuXG4gICAgICBjb25zdCBsb2dnZXIgPSBuZXcgTG9nZ2VyKCdqb2InKTtcbiAgICAgIGNvbnN0IGxvZ1N1YiA9IGxvZ2dlci5zdWJzY3JpYmUoZW50cnkgPT4ge1xuICAgICAgICBzdWJqZWN0Lm5leHQoe1xuICAgICAgICAgIGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuTG9nLFxuICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgIGVudHJ5LFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBFeGVjdXRlIHRoZSBmdW5jdGlvbiB3aXRoIHRoZSBhZGRpdGlvbmFsIGNvbnRleHQuXG4gICAgICBjb25zdCBjaGFubmVscyA9IG5ldyBNYXA8c3RyaW5nLCBTdWJqZWN0PEpzb25WYWx1ZT4+KCk7XG5cbiAgICAgIGNvbnN0IG5ld0NvbnRleHQ6IFNpbXBsZUpvYkhhbmRsZXJDb250ZXh0PEEsIEksIE8+ID0ge1xuICAgICAgICAuLi5jb250ZXh0LFxuICAgICAgICBpbnB1dDogaW5wdXRDaGFubmVsLmFzT2JzZXJ2YWJsZSgpLFxuICAgICAgICBsb2dnZXIsXG4gICAgICAgIGNyZWF0ZUNoYW5uZWwobmFtZTogc3RyaW5nKSB7XG4gICAgICAgICAgaWYgKGNoYW5uZWxzLmhhcyhuYW1lKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IENoYW5uZWxBbHJlYWR5RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGNoYW5uZWxTdWJqZWN0ID0gbmV3IFN1YmplY3Q8SnNvblZhbHVlPigpO1xuICAgICAgICAgIGNvbnN0IGNoYW5uZWxTdWIgPSBjaGFubmVsU3ViamVjdC5zdWJzY3JpYmUoXG4gICAgICAgICAgICBtZXNzYWdlID0+IHtcbiAgICAgICAgICAgICAgc3ViamVjdC5uZXh0KHtcbiAgICAgICAgICAgICAgICBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkNoYW5uZWxNZXNzYWdlLCBkZXNjcmlwdGlvbiwgbmFtZSwgbWVzc2FnZSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICBzdWJqZWN0Lm5leHQoeyBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkNoYW5uZWxFcnJvciwgZGVzY3JpcHRpb24sIG5hbWUsIGVycm9yIH0pO1xuICAgICAgICAgICAgICAvLyBUaGlzIGNhbiBiZSByZW9wZW5lZC5cbiAgICAgICAgICAgICAgY2hhbm5lbHMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgc3ViamVjdC5uZXh0KHsga2luZDogSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5DaGFubmVsQ29tcGxldGUsIGRlc2NyaXB0aW9uLCBuYW1lIH0pO1xuICAgICAgICAgICAgICAvLyBUaGlzIGNhbiBiZSByZW9wZW5lZC5cbiAgICAgICAgICAgICAgY2hhbm5lbHMuZGVsZXRlKG5hbWUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgY2hhbm5lbHMuc2V0KG5hbWUsIGNoYW5uZWxTdWJqZWN0KTtcbiAgICAgICAgICBpZiAoc3Vic2NyaXB0aW9uKSB7XG4gICAgICAgICAgICBzdWJzY3JpcHRpb24uYWRkKGNoYW5uZWxTdWIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBjaGFubmVsU3ViamVjdDtcbiAgICAgICAgfSxcbiAgICAgIH07XG5cbiAgICAgIHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuU3RhcnQsIGRlc2NyaXB0aW9uIH0pO1xuICAgICAgbGV0IHJlc3VsdCA9IGZuKGFyZ3VtZW50LCBuZXdDb250ZXh0KTtcbiAgICAgIC8vIElmIHRoZSByZXN1bHQgaXMgYSBwcm9taXNlLCBzaW1wbHkgd2FpdCBmb3IgaXQgdG8gY29tcGxldGUgYmVmb3JlIHJlcG9ydGluZyB0aGUgcmVzdWx0LlxuICAgICAgaWYgKGlzUHJvbWlzZShyZXN1bHQpKSB7XG4gICAgICAgIHJlc3VsdCA9IGZyb20ocmVzdWx0KTtcbiAgICAgIH0gZWxzZSBpZiAoIWlzT2JzZXJ2YWJsZShyZXN1bHQpKSB7XG4gICAgICAgIHJlc3VsdCA9IG9mKHJlc3VsdCBhcyBPKTtcbiAgICAgIH1cblxuICAgICAgc3Vic2NyaXB0aW9uID0gKHJlc3VsdCBhcyBPYnNlcnZhYmxlPE8+KS5zdWJzY3JpYmUoXG4gICAgICAgICh2YWx1ZTogTykgPT4gc3ViamVjdC5uZXh0KHsga2luZDogSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5PdXRwdXQsIGRlc2NyaXB0aW9uLCB2YWx1ZSB9KSxcbiAgICAgICAgZXJyb3IgPT4gc3ViamVjdC5lcnJvcihlcnJvciksXG4gICAgICAgICgpID0+IGNvbXBsZXRlKCksXG4gICAgICApO1xuICAgICAgc3Vic2NyaXB0aW9uLmFkZChpbmJvdW5kU3ViKTtcbiAgICAgIHN1YnNjcmlwdGlvbi5hZGQobG9nU3ViKTtcblxuICAgICAgcmV0dXJuIHN1YnNjcmlwdGlvbjtcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihoYW5kbGVyLCB7IGpvYkRlc2NyaXB0aW9uOiBvcHRpb25zIH0pO1xufVxuXG5cbi8qKlxuICogTGF6aWx5IGNyZWF0ZSBhIGpvYiB1c2luZyBhIGZ1bmN0aW9uLlxuICogQHBhcmFtIGxvYWRlciBBIGZhY3RvcnkgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgcHJvbWlzZS9vYnNlcnZhYmxlIG9mIGEgSm9iSGFuZGxlci5cbiAqIEBwYXJhbSBvcHRpb25zIFNhbWUgb3B0aW9ucyBhcyBjcmVhdGVKb2IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVKb2JGYWN0b3J5PEEgZXh0ZW5kcyBKc29uVmFsdWUsIEkgZXh0ZW5kcyBKc29uVmFsdWUsIE8gZXh0ZW5kcyBKc29uVmFsdWU+KFxuICBsb2FkZXI6ICgpID0+IFByb21pc2U8Sm9iSGFuZGxlcjxBLCBJLCBPPj4sXG4gIG9wdGlvbnM6IFBhcnRpYWw8Sm9iRGVzY3JpcHRpb24+ID0ge30sXG4pOiBKb2JIYW5kbGVyPEEsIEksIE8+IHtcbiAgY29uc3QgaGFuZGxlciA9IChhcmd1bWVudDogQSwgY29udGV4dDogSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4pID0+IHtcbiAgICByZXR1cm4gZnJvbShsb2FkZXIoKSlcbiAgICAgIC5waXBlKHN3aXRjaE1hcChmbiA9PiBmbihhcmd1bWVudCwgY29udGV4dCkpKTtcbiAgfTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihoYW5kbGVyLCB7IGpvYkRlc2NyaXB0aW9uOiBvcHRpb25zIH0pO1xufVxuXG5cbi8qKlxuICogQ3JlYXRlcyBhIGpvYiB0aGF0IGxvZ3Mgb3V0IGlucHV0L291dHB1dCBtZXNzYWdlcyBvZiBhbm90aGVyIEpvYi4gVGhlIG1lc3NhZ2VzIGFyZSBzdGlsbFxuICogcHJvcGFnYXRlZCB0byB0aGUgb3RoZXIgam9iLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9nZ2VySm9iPEEgZXh0ZW5kcyBKc29uVmFsdWUsIEkgZXh0ZW5kcyBKc29uVmFsdWUsIE8gZXh0ZW5kcyBKc29uVmFsdWU+KFxuICBqb2I6IEpvYkhhbmRsZXI8QSwgSSwgTz4sXG4gIGxvZ2dlcjogTG9nZ2VyQXBpLFxuKTogSm9iSGFuZGxlcjxBLCBJLCBPPiB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoYXJndW1lbnQ6IEEsIGNvbnRleHQ6IEpvYkhhbmRsZXJDb250ZXh0PEEsIEksIE8+KSA9PiB7XG4gICAgY29udGV4dC5pbmJvdW5kQnVzLnBpcGUoXG4gICAgICB0YXAobWVzc2FnZSA9PiBsb2dnZXIuaW5mbyhgSW5wdXQ6ICR7SlNPTi5zdHJpbmdpZnkobWVzc2FnZSl9YCkpLFxuICAgICkuc3Vic2NyaWJlKCk7XG5cbiAgICByZXR1cm4gam9iKGFyZ3VtZW50LCBjb250ZXh0KS5waXBlKFxuICAgICAgdGFwKFxuICAgICAgICBtZXNzYWdlID0+IGxvZ2dlci5pbmZvKGBNZXNzYWdlOiAke0pTT04uc3RyaW5naWZ5KG1lc3NhZ2UpfWApLFxuICAgICAgICBlcnJvciA9PiBsb2dnZXIud2FybihgRXJyb3I6ICR7SlNPTi5zdHJpbmdpZnkoZXJyb3IpfWApLFxuICAgICAgICAoKSA9PiBsb2dnZXIuaW5mbyhgQ29tcGxldGVkYCksXG4gICAgICApLFxuICAgICk7XG4gIH07XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oaGFuZGxlciwgam9iKTtcbn1cbiJdfQ==