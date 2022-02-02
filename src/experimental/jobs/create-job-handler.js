"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoggerJob = exports.createJobFactory = exports.createJobHandler = exports.ChannelAlreadyExistException = void 0;
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
        return new rxjs_1.Observable((subject) => {
            function complete() {
                if (subscription) {
                    subscription.unsubscribe();
                }
                subject.next({ kind: api_1.JobOutboundMessageKind.End, description });
                subject.complete();
                inputChannel.complete();
            }
            // Handle input.
            const inboundSub = inboundBus.subscribe((message) => {
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
            const newContext = {
                ...context,
                input: inputChannel.asObservable(),
                createChannel(name) {
                    if (channels.has(name)) {
                        throw new ChannelAlreadyExistException(name);
                    }
                    const channelSubject = new rxjs_1.Subject();
                    const channelSub = channelSubject.subscribe((message) => {
                        subject.next({
                            kind: api_1.JobOutboundMessageKind.ChannelMessage,
                            description,
                            name,
                            message,
                        });
                    }, (error) => {
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
                },
            };
            subject.next({ kind: api_1.JobOutboundMessageKind.Start, description });
            let result = fn(argument, newContext);
            // If the result is a promise, simply wait for it to complete before reporting the result.
            if ((0, index_2.isPromise)(result)) {
                result = (0, rxjs_1.from)(result);
            }
            else if (!(0, rxjs_1.isObservable)(result)) {
                result = (0, rxjs_1.of)(result);
            }
            subscription = result.subscribe((value) => subject.next({ kind: api_1.JobOutboundMessageKind.Output, description, value }), (error) => subject.error(error), () => complete());
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
        return (0, rxjs_1.from)(loader()).pipe((0, operators_1.switchMap)((fn) => fn(argument, context)));
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
        context.inboundBus
            .pipe((0, operators_1.tap)((message) => logger.info(`Input: ${JSON.stringify(message)}`)))
            .subscribe();
        return job(argument, context).pipe((0, operators_1.tap)((message) => logger.info(`Message: ${JSON.stringify(message)}`), (error) => logger.warn(`Error: ${JSON.stringify(error)}`), () => logger.info(`Completed`)));
    };
    return Object.assign(handler, job);
}
exports.createLoggerJob = createLoggerJob;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWpvYi1oYW5kbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvZXhwZXJpbWVudGFsL2pvYnMvY3JlYXRlLWpvYi1oYW5kbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILCtCQUEyRjtBQUMzRiw4Q0FBZ0Q7QUFDaEQsaURBQXNEO0FBR3RELDZDQUE4QztBQUM5QywrQkFPZTtBQUVmLE1BQWEsNEJBQTZCLFNBQVEscUJBQWE7SUFDN0QsWUFBWSxJQUFZO1FBQ3RCLEtBQUssQ0FBQyxXQUFXLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDMUQsQ0FBQztDQUNGO0FBSkQsb0VBSUM7QUF5QkQ7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQzlCLEVBQStCLEVBQy9CLFVBQW1DLEVBQUU7SUFFckMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxRQUFXLEVBQUUsT0FBbUMsRUFBRSxFQUFFO1FBQ25FLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUM7UUFDeEMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztRQUN0QyxNQUFNLFlBQVksR0FBRyxJQUFJLGNBQU8sRUFBSyxDQUFDO1FBQ3RDLElBQUksWUFBMEIsQ0FBQztRQUUvQixPQUFPLElBQUksaUJBQVUsQ0FBd0IsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUN2RCxTQUFTLFFBQVE7Z0JBQ2YsSUFBSSxZQUFZLEVBQUU7b0JBQ2hCLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQztpQkFDNUI7Z0JBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSw0QkFBc0IsQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztnQkFDaEUsT0FBTyxDQUFD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QztBQUVEOzs7R0FHRztBQUNILFNBQWdCLGVBQWUsQ0FDN0IsR0FBd0IsRUFDeEIsTUFBaUI7SUFFakIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxRQUFXLEVBQUUsT0FBbUMsRUFBRSxFQUFFO1FBQ25FLE9BQU8sQ0FBQyxVQUFVO2FBQ2YsSUFBSSxDQUFDLElBQUEsZUFBRyxFQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzthQUN4RSxTQUFTLEVBQUUsQ0FBQztRQUVmLE9BQU8sR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQ2hDLElBQUEsZUFBRyxFQUNELENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQy9ELENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQ3pELEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQy9CLENBQ0YsQ0FBQztJQUNKLENBQUMsQ0FBQztJQUVGLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQW5CRCwwQ0FtQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgT2JzZXJ2ZXIsIFN1YmplY3QsIFN1YnNjcmlwdGlvbiwgZnJvbSwgaXNPYnNlcnZhYmxlLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgc3dpdGNoTWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBCYXNlRXhjZXB0aW9uIH0gZnJvbSAnLi4vLi4vZXhjZXB0aW9uL2luZGV4JztcbmltcG9ydCB7IEpzb25WYWx1ZSB9IGZyb20gJy4uLy4uL2pzb24vaW5kZXgnO1xuaW1wb3J0IHsgTG9nZ2VyQXBpIH0gZnJvbSAnLi4vLi4vbG9nZ2VyJztcbmltcG9ydCB7IGlzUHJvbWlzZSB9IGZyb20gJy4uLy4uL3V0aWxzL2luZGV4JztcbmltcG9ydCB7XG4gIEpvYkRlc2NyaXB0aW9uLFxuICBKb2JIYW5kbGVyLFxuICBKb2JIYW5kbGVyQ29udGV4dCxcbiAgSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLFxuICBKb2JPdXRib3VuZE1lc3NhZ2UsXG4gIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQsXG59IGZyb20gJy4vYXBpJztcblxuZXhwb3J0IGNsYXNzIENoYW5uZWxBbHJlYWR5RXhpc3RFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoYENoYW5uZWwgJHtKU09OLnN0cmluZ2lmeShuYW1lKX0gYWxyZWFkeSBleGlzdC5gKTtcbiAgfVxufVxuXG4vKipcbiAqIEludGVyZmFjZSBmb3IgdGhlIEpvYkhhbmRsZXIgY29udGV4dCB0aGF0IGlzIHVzZWQgd2hlbiB1c2luZyBgY3JlYXRlSm9iSGFuZGxlcigpYC4gSXQgZXh0ZW5kc1xuICogdGhlIGJhc2ljIGBKb2JIYW5kbGVyQ29udGV4dGAgd2l0aCBhZGRpdGlvbmFsIGZ1bmN0aW9uYWxpdHkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2ltcGxlSm9iSGFuZGxlckNvbnRleHQ8XG4gIEEgZXh0ZW5kcyBKc29uVmFsdWUsXG4gIEkgZXh0ZW5kcyBKc29uVmFsdWUsXG4gIE8gZXh0ZW5kcyBKc29uVmFsdWVcbj4gZXh0ZW5kcyBKb2JIYW5kbGVyQ29udGV4dDxBLCBJLCBPPiB7XG4gIGNyZWF0ZUNoYW5uZWw6IChuYW1lOiBzdHJpbmcpID0+IE9ic2VydmVyPEpzb25WYWx1ZT47XG4gIGlucHV0OiBPYnNlcnZhYmxlPEk+O1xufVxuXG4vKipcbiAqIEEgc2ltcGxlIHZlcnNpb24gb2YgdGhlIEpvYkhhbmRsZXIuIFRoaXMgc2ltcGxpZmllcyBhIGxvdCBvZiB0aGUgaW50ZXJhY3Rpb24gd2l0aCB0aGUgam9iXG4gKiBzY2hlZHVsZXIgYW5kIHJlZ2lzdHJ5LiBGb3IgZXhhbXBsZSwgaW5zdGVhZCBvZiByZXR1cm5pbmcgYSBKb2JPdXRib3VuZE1lc3NhZ2Ugb2JzZXJ2YWJsZSwgeW91XG4gKiBjYW4gZGlyZWN0bHkgcmV0dXJuIGFuIG91dHB1dC5cbiAqL1xuZXhwb3J0IHR5cGUgU2ltcGxlSm9iSGFuZGxlckZuPEEgZXh0ZW5kcyBKc29uVmFsdWUsIEkgZXh0ZW5kcyBKc29uVmFsdWUsIE8gZXh0ZW5kcyBKc29uVmFsdWU+ID0gKFxuICBpbnB1dDogQSxcbiAgY29udGV4dDogU2ltcGxlSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4sXG4pID0+IE8gfCBQcm9taXNlPE8+IHwgT2JzZXJ2YWJsZTxPPjtcblxuLyoqXG4gKiBNYWtlIGEgc2ltcGxlIGpvYiBoYW5kbGVyIHRoYXQgc2V0cyBzdGFydCBhbmQgZW5kIGZyb20gYSBmdW5jdGlvbiB0aGF0J3Mgc3luY2hyb25vdXMuXG4gKlxuICogQHBhcmFtIGZuIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgYSBoYW5kbGVyIGZvci5cbiAqIEBwYXJhbSBvcHRpb25zIEFuIG9wdGlvbmFsIHNldCBvZiBwcm9wZXJ0aWVzIHRvIHNldCBvbiB0aGUgaGFuZGxlci4gU29tZSBmaWVsZHMgbWlnaHQgYmVcbiAqICAgcmVxdWlyZWQgYnkgcmVnaXN0cnkgb3Igc2NoZWR1bGVycy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUpvYkhhbmRsZXI8QSBleHRlbmRzIEpzb25WYWx1ZSwgSSBleHRlbmRzIEpzb25WYWx1ZSwgTyBleHRlbmRzIEpzb25WYWx1ZT4oXG4gIGZuOiBTaW1wbGVKb2JIYW5kbGVyRm48QSwgSSwgTz4sXG4gIG9wdGlvbnM6IFBhcnRpYWw8Sm9iRGVzY3JpcHRpb24+ID0ge30sXG4pOiBKb2JIYW5kbGVyPEEsIEksIE8+IHtcbiAgY29uc3QgaGFuZGxlciA9IChhcmd1bWVudDogQSwgY29udGV4dDogSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4pID0+IHtcbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGNvbnRleHQuZGVzY3JpcHRpb247XG4gICAgY29uc3QgaW5ib3VuZEJ1cyA9IGNvbnRleHQuaW5ib3VuZEJ1cztcbiAgICBjb25zdCBpbnB1dENoYW5uZWwgPSBuZXcgU3ViamVjdDxJPigpO1xuICAgIGxldCBzdWJzY3JpcHRpb246IFN1YnNjcmlwdGlvbjtcblxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+KChzdWJqZWN0KSA9PiB7XG4gICAgICBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcbiAgICAgICAgaWYgKHN1YnNjcmlwdGlvbikge1xuICAgICAgICAgIHN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgICAgICB9XG4gICAgICAgIHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuRW5kLCBkZXNjcmlwdGlvbiB9KTtcbiAgICAgICAgc3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICBpbnB1dENoYW5uZWwuY29tcGxldGUoKTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIGlucHV0LlxuICAgICAgY29uc3QgaW5ib3VuZFN1YiA9IGluYm91bmRCdXMuc3Vic2NyaWJlKChtZXNzYWdlKSA9PiB7XG4gICAgICAgIHN3aXRjaCAobWVzc2FnZS5raW5kKSB7XG4gICAgICAgICAgY2FzZSBKb2JJbmJvdW5kTWVzc2FnZUtpbmQuUGluZzpcbiAgICAgICAgICAgIHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuUG9uZywgZGVzY3JpcHRpb24sIGlkOiBtZXNzYWdlLmlkIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlIEpvYkluYm91bmRNZXNzYWdlS2luZC5TdG9wOlxuICAgICAgICAgICAgLy8gVGhlcmUncyBubyB3YXkgdG8gY2FuY2VsIGEgcHJvbWlzZSBvciBhIHN5bmNocm9ub3VzIGZ1bmN0aW9uLCBidXQgd2UgZG8gY2FuY2VsXG4gICAgICAgICAgICAvLyBvYnNlcnZhYmxlcyB3aGVyZSBwb3NzaWJsZS5cbiAgICAgICAgICAgIGNvbXBsZXRlKCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLklucHV0OlxuICAgICAgICAgICAgaW5wdXRDaGFubmVsLm5leHQobWVzc2FnZS52YWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIEV4ZWN1dGUgdGhlIGZ1bmN0aW9uIHdpdGggdGhlIGFkZGl0aW9uYWwgY29udGV4dC5cbiAgICAgIGNvbnN0IGNoYW5uZWxzID0gbmV3IE1hcDxzdHJpbmcsIFN1YmplY3Q8SnNvblZhbHVlPj4oKTtcblxuICAgICAgY29uc3QgbmV3Q29udGV4dDogU2ltcGxlSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4gPSB7XG4gICAgICAgIC4uLmNvbnRleHQsXG4gICAgICAgIGlucHV0OiBpbnB1dENoYW5uZWwuYXNPYnNlcnZhYmxlKCksXG4gICAgICAgIGNyZWF0ZUNoYW5uZWwobmFtZTogc3RyaW5nKSB7XG4gICAgICAgICAgaWYgKGNoYW5uZWxzLmhhcyhuYW1lKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IENoYW5uZWxBbHJlYWR5RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGNoYW5uZWxTdWJqZWN0ID0gbmV3IFN1YmplY3Q8SnNvblZhbHVlPigpO1xuICAgICAgICAgIGNvbnN0IGNoYW5uZWxTdWIgPSBjaGFubmVsU3ViamVjdC5zdWJzY3JpYmUoXG4gICAgICAgICAgICAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICBzdWJqZWN0Lm5leHQoe1xuICAgICAgICAgICAgICAgIGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbE1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgc3ViamVjdC5uZXh0KHsga2luZDogSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5DaGFubmVsRXJyb3IsIGRlc2NyaXB0aW9uLCBuYW1lLCBlcnJvciB9KTtcbiAgICAgICAgICAgICAgLy8gVGhpcyBjYW4gYmUgcmVvcGVuZWQuXG4gICAgICAgICAgICAgIGNoYW5uZWxzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgIHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbENvbXBsZXRlLCBkZXNjcmlwdGlvbiwgbmFtZSB9KTtcbiAgICAgICAgICAgICAgLy8gVGhpcyBjYW4gYmUgcmVvcGVuZWQuXG4gICAgICAgICAgICAgIGNoYW5uZWxzLmRlbGV0ZShuYW1lKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGNoYW5uZWxzLnNldChuYW1lLCBjaGFubmVsU3ViamVjdCk7XG4gICAgICAgICAgaWYgKHN1YnNjcmlwdGlvbikge1xuICAgICAgICAgICAgc3Vic2NyaXB0aW9uLmFkZChjaGFubmVsU3ViKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gY2hhbm5lbFN1YmplY3Q7XG4gICAgICAgIH0sXG4gICAgICB9O1xuXG4gICAgICBzdWJqZWN0Lm5leHQoeyBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlN0YXJ0LCBkZXNjcmlwdGlvbiB9KTtcbiAgICAgIGxldCByZXN1bHQgPSBmbihhcmd1bWVudCwgbmV3Q29udGV4dCk7XG4gICAgICAvLyBJZiB0aGUgcmVzdWx0IGlzIGEgcHJvbWlzZSwgc2ltcGx5IHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSByZXBvcnRpbmcgdGhlIHJlc3VsdC5cbiAgICAgIGlmIChpc1Byb21pc2UocmVzdWx0KSkge1xuICAgICAgICByZXN1bHQgPSBmcm9tKHJlc3VsdCk7XG4gICAgICB9IGVsc2UgaWYgKCFpc09ic2VydmFibGUocmVzdWx0KSkge1xuICAgICAgICByZXN1bHQgPSBvZihyZXN1bHQgYXMgTyk7XG4gICAgICB9XG5cbiAgICAgIHN1YnNjcmlwdGlvbiA9IChyZXN1bHQgYXMgT2JzZXJ2YWJsZTxPPikuc3Vic2NyaWJlKFxuICAgICAgICAodmFsdWU6IE8pID0+IHN1YmplY3QubmV4dCh7IGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuT3V0cHV0LCBkZXNjcmlwdGlvbiwgdmFsdWUgfSksXG4gICAgICAgIChlcnJvcikgPT4gc3ViamVjdC5lcnJvcihlcnJvciksXG4gICAgICAgICgpID0+IGNvbXBsZXRlKCksXG4gICAgICApO1xuICAgICAgc3Vic2NyaXB0aW9uLmFkZChpbmJvdW5kU3ViKTtcblxuICAgICAgcmV0dXJuIHN1YnNjcmlwdGlvbjtcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihoYW5kbGVyLCB7IGpvYkRlc2NyaXB0aW9uOiBvcHRpb25zIH0pO1xufVxuXG4vKipcbiAqIExhemlseSBjcmVhdGUgYSBqb2IgdXNpbmcgYSBmdW5jdGlvbi5cbiAqIEBwYXJhbSBsb2FkZXIgQSBmYWN0b3J5IGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHByb21pc2Uvb2JzZXJ2YWJsZSBvZiBhIEpvYkhhbmRsZXIuXG4gKiBAcGFyYW0gb3B0aW9ucyBTYW1lIG9wdGlvbnMgYXMgY3JlYXRlSm9iLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSm9iRmFjdG9yeTxBIGV4dGVuZHMgSnNvblZhbHVlLCBJIGV4dGVuZHMgSnNvblZhbHVlLCBPIGV4dGVuZHMgSnNvblZhbHVlPihcbiAgbG9hZGVyOiAoKSA9PiBQcm9taXNlPEpvYkhhbmRsZXI8QSwgSSwgTz4+LFxuICBvcHRpb25zOiBQYXJ0aWFsPEpvYkRlc2NyaXB0aW9uPiA9IHt9LFxuKTogSm9iSGFuZGxlcjxBLCBJLCBPPiB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoYXJndW1lbnQ6IEEsIGNvbnRleHQ6IEpvYkhhbmRsZXJDb250ZXh0PEEsIEksIE8+KSA9PiB7XG4gICAgcmV0dXJuIGZyb20obG9hZGVyKCkpLnBpcGUoc3dpdGNoTWFwKChmbikgPT4gZm4oYXJndW1lbnQsIGNvbnRleHQpKSk7XG4gIH07XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oaGFuZGxlciwgeyBqb2JEZXNjcmlwdGlvbjogb3B0aW9ucyB9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgam9iIHRoYXQgbG9ncyBvdXQgaW5wdXQvb3V0cHV0IG1lc3NhZ2VzIG9mIGFub3RoZXIgSm9iLiBUaGUgbWVzc2FnZXMgYXJlIHN0aWxsXG4gKiBwcm9wYWdhdGVkIHRvIHRoZSBvdGhlciBqb2IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2dnZXJKb2I8QSBleHRlbmRzIEpzb25WYWx1ZSwgSSBleHRlbmRzIEpzb25WYWx1ZSwgTyBleHRlbmRzIEpzb25WYWx1ZT4oXG4gIGpvYjogSm9iSGFuZGxlcjxBLCBJLCBPPixcbiAgbG9nZ2VyOiBMb2dnZXJBcGksXG4pOiBKb2JIYW5kbGVyPEEsIEksIE8+IHtcbiAgY29uc3QgaGFuZGxlciA9IChhcmd1bWVudDogQSwgY29udGV4dDogSm9iSGFuZGxlckNvbnRleHQ8QSwgSSwgTz4pID0+IHtcbiAgICBjb250ZXh0LmluYm91bmRCdXNcbiAgICAgIC5waXBlKHRhcCgobWVzc2FnZSkgPT4gbG9nZ2VyLmluZm8oYElucHV0OiAke0pTT04uc3RyaW5naWZ5KG1lc3NhZ2UpfWApKSlcbiAgICAgIC5zdWJzY3JpYmUoKTtcblxuICAgIHJldHVybiBqb2IoYXJndW1lbnQsIGNvbnRleHQpLnBpcGUoXG4gICAgICB0YXAoXG4gICAgICAgIChtZXNzYWdlKSA9PiBsb2dnZXIuaW5mbyhgTWVzc2FnZTogJHtKU09OLnN0cmluZ2lmeShtZXNzYWdlKX1gKSxcbiAgICAgICAgKGVycm9yKSA9PiBsb2dnZXIud2FybihgRXJyb3I6ICR7SlNPTi5zdHJpbmdpZnkoZXJyb3IpfWApLFxuICAgICAgICAoKSA9PiBsb2dnZXIuaW5mbyhgQ29tcGxldGVkYCksXG4gICAgICApLFxuICAgICk7XG4gIH07XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oaGFuZGxlciwgam9iKTtcbn1cbiJdfQ==