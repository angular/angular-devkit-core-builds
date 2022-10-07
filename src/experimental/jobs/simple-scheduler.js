"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleScheduler = exports.JobOutputSchemaValidationError = exports.JobInboundMessageSchemaValidationError = exports.JobArgumentSchemaValidationError = void 0;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const json_1 = require("../../json");
const api_1 = require("./api");
const exception_1 = require("./exception");
class JobArgumentSchemaValidationError extends json_1.schema.SchemaValidationException {
    constructor(errors) {
        super(errors, 'Job Argument failed to validate. Errors: ');
    }
}
exports.JobArgumentSchemaValidationError = JobArgumentSchemaValidationError;
class JobInboundMessageSchemaValidationError extends json_1.schema.SchemaValidationException {
    constructor(errors) {
        super(errors, 'Job Inbound Message failed to validate. Errors: ');
    }
}
exports.JobInboundMessageSchemaValidationError = JobInboundMessageSchemaValidationError;
class JobOutputSchemaValidationError extends json_1.schema.SchemaValidationException {
    constructor(errors) {
        super(errors, 'Job Output failed to validate. Errors: ');
    }
}
exports.JobOutputSchemaValidationError = JobOutputSchemaValidationError;
function _jobShare() {
    // This is the same code as a `shareReplay()` operator, but uses a dumber Subject rather than a
    // ReplaySubject.
    return (source) => {
        let refCount = 0;
        let subject;
        let hasError = false;
        let isComplete = false;
        let subscription;
        return new rxjs_1.Observable((subscriber) => {
            let innerSub;
            refCount++;
            if (!subject) {
                subject = new rxjs_1.Subject();
                innerSub = subject.subscribe(subscriber);
                subscription = source.subscribe({
                    next(value) {
                        subject.next(value);
                    },
                    error(err) {
                        hasError = true;
                        subject.error(err);
                    },
                    complete() {
                        isComplete = true;
                        subject.complete();
                    },
                });
            }
            else {
                innerSub = subject.subscribe(subscriber);
            }
            return () => {
                refCount--;
                innerSub.unsubscribe();
                if (subscription && refCount === 0 && (isComplete || hasError)) {
                    subscription.unsubscribe();
                }
            };
        });
    };
}
/**
 * Simple scheduler. Should be the base of all registries and schedulers.
 */
class SimpleScheduler {
    constructor(_jobRegistry, _schemaRegistry = new json_1.schema.CoreSchemaRegistry()) {
        this._jobRegistry = _jobRegistry;
        this._schemaRegistry = _schemaRegistry;
        this._internalJobDescriptionMap = new Map();
        this._queue = [];
        this._pauseCounter = 0;
    }
    _getInternalDescription(name) {
        const maybeHandler = this._internalJobDescriptionMap.get(name);
        if (maybeHandler !== undefined) {
            return (0, rxjs_1.of)(maybeHandler);
        }
        const handler = this._jobRegistry.get(name);
        return handler.pipe((0, operators_1.switchMap)((handler) => {
            if (handler === null) {
                return (0, rxjs_1.of)(null);
            }
            const description = {
                // Make a copy of it to be sure it's proper JSON.
                ...JSON.parse(JSON.stringify(handler.jobDescription)),
                name: handler.jobDescription.name || name,
                argument: handler.jobDescription.argument || true,
                input: handler.jobDescription.input || true,
                output: handler.jobDescription.output || true,
                channels: handler.jobDescription.channels || {},
            };
            const handlerWithExtra = Object.assign(handler.bind(undefined), {
                jobDescription: description,
                argumentV: this._schemaRegistry.compile(description.argument).pipe((0, operators_1.shareReplay)(1)),
                inputV: this._schemaRegistry.compile(description.input).pipe((0, operators_1.shareReplay)(1)),
                outputV: this._schemaRegistry.compile(description.output).pipe((0, operators_1.shareReplay)(1)),
            });
            this._internalJobDescriptionMap.set(name, handlerWithExtra);
            return (0, rxjs_1.of)(handlerWithExtra);
        }));
    }
    /**
     * Get a job description for a named job.
     *
     * @param name The name of the job.
     * @returns A description, or null if the job is not registered.
     */
    getDescription(name) {
        return (0, rxjs_1.concat)(this._getInternalDescription(name).pipe((0, operators_1.map)((x) => x && x.jobDescription)), (0, rxjs_1.of)(null)).pipe((0, operators_1.first)());
    }
    /**
     * Returns true if the job name has been registered.
     * @param name The name of the job.
     * @returns True if the job exists, false otherwise.
     */
    has(name) {
        return this.getDescription(name).pipe((0, operators_1.map)((x) => x !== null));
    }
    /**
     * Pause the scheduler, temporary queueing _new_ jobs. Returns a resume function that should be
     * used to resume execution. If multiple `pause()` were called, all their resume functions must
     * be called before the Scheduler actually starts new jobs. Additional calls to the same resume
     * function will have no effect.
     *
     * Jobs already running are NOT paused. This is pausing the scheduler only.
     */
    pause() {
        let called = false;
        this._pauseCounter++;
        return () => {
            if (!called) {
                called = true;
                if (--this._pauseCounter == 0) {
                    // Resume the queue.
                    const q = this._queue;
                    this._queue = [];
                    q.forEach((fn) => fn());
                }
            }
        };
    }
    /**
     * Schedule a job to be run, using its name.
     * @param name The name of job to be run.
     * @param argument The argument to send to the job when starting it.
     * @param options Scheduling options.
     * @returns The Job being run.
     */
    schedule(name, argument, options) {
        if (this._pauseCounter > 0) {
            const waitable = new rxjs_1.Subject();
            this._queue.push(() => waitable.complete());
            return this._scheduleJob(name, argument, options || {}, waitable);
        }
        return this._scheduleJob(name, argument, options || {}, rxjs_1.EMPTY);
    }
    /**
     * Filter messages.
     * @private
     */
    _filterJobOutboundMessages(message, state) {
        switch (message.kind) {
            case api_1.JobOutboundMessageKind.OnReady:
                return state == api_1.JobState.Queued;
            case api_1.JobOutboundMessageKind.Start:
                return state == api_1.JobState.Ready;
            case api_1.JobOutboundMessageKind.End:
                return state == api_1.JobState.Started || state == api_1.JobState.Ready;
        }
        return true;
    }
    /**
     * Return a new state. This is just to simplify the reading of the _createJob method.
     * @private
     */
    _updateState(message, state) {
        switch (message.kind) {
            case api_1.JobOutboundMessageKind.OnReady:
                return api_1.JobState.Ready;
            case api_1.JobOutboundMessageKind.Start:
                return api_1.JobState.Started;
            case api_1.JobOutboundMessageKind.End:
                return api_1.JobState.Ended;
        }
        return state;
    }
    /**
     * Create the job.
     * @private
     */
    _createJob(name, argument, handler, inboundBus, outboundBus) {
        const schemaRegistry = this._schemaRegistry;
        const channelsSubject = new Map();
        const channels = new Map();
        let state = api_1.JobState.Queued;
        let pingId = 0;
        // Create the input channel by having a filter.
        const input = new rxjs_1.Subject();
        input
            .pipe((0, operators_1.concatMap)((message) => handler.pipe((0, operators_1.switchMap)((handler) => {
            if (handler === null) {
                throw new exception_1.JobDoesNotExistException(name);
            }
            else {
                return handler.inputV.pipe((0, operators_1.switchMap)((validate) => validate(message)));
            }
        }))), (0, operators_1.filter)((result) => result.success), (0, operators_1.map)((result) => result.data))
            .subscribe((value) => inboundBus.next({ kind: api_1.JobInboundMessageKind.Input, value }));
        outboundBus = (0, rxjs_1.concat)(outboundBus, 
        // Add an End message at completion. This will be filtered out if the job actually send an
        // End.
        handler.pipe((0, operators_1.switchMap)((handler) => {
            if (handler) {
                return (0, rxjs_1.of)({
                    kind: api_1.JobOutboundMessageKind.End,
                    description: handler.jobDescription,
                });
            }
            else {
                return rxjs_1.EMPTY;
            }
        }))).pipe((0, operators_1.filter)((message) => this._filterJobOutboundMessages(message, state)), 
        // Update internal logic and Job<> members.
        (0, operators_1.tap)((message) => {
            // Update the state.
            state = this._updateState(message, state);
            switch (message.kind) {
                case api_1.JobOutboundMessageKind.ChannelCreate: {
                    const maybeSubject = channelsSubject.get(message.name);
                    // If it doesn't exist or it's closed on the other end.
                    if (!maybeSubject) {
                        const s = new rxjs_1.Subject();
                        channelsSubject.set(message.name, s);
                        channels.set(message.name, s.asObservable());
                    }
                    break;
                }
                case api_1.JobOutboundMessageKind.ChannelMessage: {
                    const maybeSubject = channelsSubject.get(message.name);
                    if (maybeSubject) {
                        maybeSubject.next(message.message);
                    }
                    break;
                }
                case api_1.JobOutboundMessageKind.ChannelComplete: {
                    const maybeSubject = channelsSubject.get(message.name);
                    if (maybeSubject) {
                        maybeSubject.complete();
                        channelsSubject.delete(message.name);
                    }
                    break;
                }
                case api_1.JobOutboundMessageKind.ChannelError: {
                    const maybeSubject = channelsSubject.get(message.name);
                    if (maybeSubject) {
                        maybeSubject.error(message.error);
                        channelsSubject.delete(message.name);
                    }
                    break;
                }
            }
        }, () => {
            state = api_1.JobState.Errored;
        }), 
        // Do output validation (might include default values so this might have side
        // effects). We keep all messages in order.
        (0, operators_1.concatMap)((message) => {
            if (message.kind !== api_1.JobOutboundMessageKind.Output) {
                return (0, rxjs_1.of)(message);
            }
            return handler.pipe((0, operators_1.switchMap)((handler) => {
                if (handler === null) {
                    throw new exception_1.JobDoesNotExistException(name);
                }
                else {
                    return handler.outputV.pipe((0, operators_1.switchMap)((validate) => validate(message.value)), (0, operators_1.switchMap)((output) => {
                        if (!output.success) {
                            throw new JobOutputSchemaValidationError(output.errors);
                        }
                        return (0, rxjs_1.of)({
                            ...message,
                            output: output.data,
                        });
                    }));
                }
            }));
        }), _jobShare());
        const output = outboundBus.pipe((0, operators_1.filter)((x) => x.kind == api_1.JobOutboundMessageKind.Output), (0, operators_1.map)((x) => x.value), (0, operators_1.shareReplay)(1));
        // Return the Job.
        return {
            get state() {
                return state;
            },
            argument,
            description: handler.pipe((0, operators_1.switchMap)((handler) => {
                if (handler === null) {
                    throw new exception_1.JobDoesNotExistException(name);
                }
                else {
                    return (0, rxjs_1.of)(handler.jobDescription);
                }
            })),
            output,
            getChannel(name, schema = true) {
                let maybeObservable = channels.get(name);
                if (!maybeObservable) {
                    const s = new rxjs_1.Subject();
                    channelsSubject.set(name, s);
                    channels.set(name, s.asObservable());
                    maybeObservable = s.asObservable();
                }
                return maybeObservable.pipe(
                // Keep the order of messages.
                (0, operators_1.concatMap)((message) => {
                    return schemaRegistry.compile(schema).pipe((0, operators_1.switchMap)((validate) => validate(message)), (0, operators_1.filter)((x) => x.success), (0, operators_1.map)((x) => x.data));
                }));
            },
            ping() {
                const id = pingId++;
                inboundBus.next({ kind: api_1.JobInboundMessageKind.Ping, id });
                return outboundBus.pipe((0, operators_1.filter)((x) => x.kind === api_1.JobOutboundMessageKind.Pong && x.id == id), (0, operators_1.first)(), (0, operators_1.ignoreElements)());
            },
            stop() {
                inboundBus.next({ kind: api_1.JobInboundMessageKind.Stop });
            },
            input,
            inboundBus,
            outboundBus,
        };
    }
    _scheduleJob(name, argument, options, waitable) {
        // Get handler first, since this can error out if there's no handler for the job name.
        const handler = this._getInternalDescription(name);
        const optionsDeps = (options && options.dependencies) || [];
        const dependencies = Array.isArray(optionsDeps) ? optionsDeps : [optionsDeps];
        const inboundBus = new rxjs_1.Subject();
        const outboundBus = (0, rxjs_1.concat)(
        // Wait for dependencies, make sure to not report messages from dependencies. Subscribe to
        // all dependencies at the same time so they run concurrently.
        (0, rxjs_1.merge)(...dependencies.map((x) => x.outboundBus)).pipe((0, operators_1.ignoreElements)()), 
        // Wait for pause() to clear (if necessary).
        waitable, (0, rxjs_1.from)(handler).pipe((0, operators_1.switchMap)((handler) => new rxjs_1.Observable((subscriber) => {
            if (!handler) {
                throw new exception_1.JobDoesNotExistException(name);
            }
            // Validate the argument.
            return handler.argumentV
                .pipe((0, operators_1.switchMap)((validate) => validate(argument)), (0, operators_1.switchMap)((output) => {
                if (!output.success) {
                    throw new JobArgumentSchemaValidationError(output.errors);
                }
                const argument = output.data;
                const description = handler.jobDescription;
                subscriber.next({ kind: api_1.JobOutboundMessageKind.OnReady, description });
                const context = {
                    description,
                    dependencies: [...dependencies],
                    inboundBus: inboundBus.asObservable(),
                    scheduler: this,
                };
                return handler(argument, context);
            }))
                .subscribe(subscriber);
        }))));
        return this._createJob(name, argument, handler, inboundBus, outboundBus);
    }
}
exports.SimpleScheduler = SimpleScheduler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltcGxlLXNjaGVkdWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2V4cGVyaW1lbnRhbC9qb2JzL3NpbXBsZS1zY2hlZHVsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsK0JBV2M7QUFDZCw4Q0FTd0I7QUFDeEIscUNBQStDO0FBQy9DLCtCQWNlO0FBQ2YsMkNBQXVEO0FBRXZELE1BQWEsZ0NBQWlDLFNBQVEsYUFBTSxDQUFDLHlCQUF5QjtJQUNwRixZQUFZLE1BQXNDO1FBQ2hELEtBQUssQ0FBQyxNQUFNLEVBQUUsMkNBQTJDLENBQUMsQ0FBQztJQUM3RCxDQUFDO0NBQ0Y7QUFKRCw0RUFJQztBQUNELE1BQWEsc0NBQXVDLFNBQVEsYUFBTSxDQUFDLHlCQUF5QjtJQUMxRixZQUFZLE1BQXNDO1FBQ2hELEtBQUssQ0FBQyxNQUFNLEVBQUUsa0RBQWtELENBQUMsQ0FBQztJQUNwRSxDQUFDO0NBQ0Y7QUFKRCx3RkFJQztBQUNELE1BQWEsOEJBQStCLFNBQVEsYUFBTSxDQUFDLHlCQUF5QjtJQUNsRixZQUFZLE1BQXNDO1FBQ2hELEtBQUssQ0FBQyxNQUFNLEVBQUUseUNBQXlDLENBQUMsQ0FBQztJQUMzRCxDQUFDO0NBQ0Y7QUFKRCx3RUFJQztBQVVELFNBQVMsU0FBUztJQUNoQiwrRkFBK0Y7SUFDL0YsaUJBQWlCO0lBQ2pCLE9BQU8sQ0FBQyxNQUFxQixFQUFpQixFQUFFO1FBQzlDLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztRQUNqQixJQUFJLE9BQW1CLENBQUM7UUFDeEIsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLFlBQTBCLENBQUM7UUFFL0IsT0FBTyxJQUFJLGlCQUFVLENBQUksQ0FBQyxVQUFVLEVB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QUVGLE9BQU8sT0FBTyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNwQyxDQUFDLENBQUMsQ0FDSDtpQkFDQSxTQUFTLENBQUMsVUFBcUQsQ0FBQyxDQUFDO1FBQ3RFLENBQUMsQ0FBQyxDQUNMLENBQ0YsQ0FDRixDQUFDO1FBRUYsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUMzRSxDQUFDO0NBQ0Y7QUE3YUQsMENBNmFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEVNUFRZLFxuICBNb25vVHlwZU9wZXJhdG9yRnVuY3Rpb24sXG4gIE9ic2VydmFibGUsXG4gIE9ic2VydmVyLFxuICBTdWJqZWN0LFxuICBTdWJzY3JpcHRpb24sXG4gIGNvbmNhdCxcbiAgZnJvbSxcbiAgbWVyZ2UsXG4gIG9mLFxufSBmcm9tICdyeGpzJztcbmltcG9ydCB7XG4gIGNvbmNhdE1hcCxcbiAgZmlsdGVyLFxuICBmaXJzdCxcbiAgaWdub3JlRWxlbWVudHMsXG4gIG1hcCxcbiAgc2hhcmVSZXBsYXksXG4gIHN3aXRjaE1hcCxcbiAgdGFwLFxufSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBKc29uVmFsdWUsIHNjaGVtYSB9IGZyb20gJy4uLy4uL2pzb24nO1xuaW1wb3J0IHtcbiAgSm9iLFxuICBKb2JEZXNjcmlwdGlvbixcbiAgSm9iSGFuZGxlcixcbiAgSm9iSW5ib3VuZE1lc3NhZ2UsXG4gIEpvYkluYm91bmRNZXNzYWdlS2luZCxcbiAgSm9iTmFtZSxcbiAgSm9iT3V0Ym91bmRNZXNzYWdlLFxuICBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLFxuICBKb2JPdXRib3VuZE1lc3NhZ2VPdXRwdXQsXG4gIEpvYlN0YXRlLFxuICBSZWdpc3RyeSxcbiAgU2NoZWR1bGVKb2JPcHRpb25zLFxuICBTY2hlZHVsZXIsXG59IGZyb20gJy4vYXBpJztcbmltcG9ydCB7IEpvYkRvZXNOb3RFeGlzdEV4Y2VwdGlvbiB9IGZyb20gJy4vZXhjZXB0aW9uJztcblxuZXhwb3J0IGNsYXNzIEpvYkFyZ3VtZW50U2NoZW1hVmFsaWRhdGlvbkVycm9yIGV4dGVuZHMgc2NoZW1hLlNjaGVtYVZhbGlkYXRpb25FeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihlcnJvcnM/OiBzY2hlbWEuU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSkge1xuICAgIHN1cGVyKGVycm9ycywgJ0pvYiBBcmd1bWVudCBmYWlsZWQgdG8gdmFsaWRhdGUuIEVycm9yczogJyk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBKb2JJbmJvdW5kTWVzc2FnZVNjaGVtYVZhbGlkYXRpb25FcnJvciBleHRlbmRzIHNjaGVtYS5TY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoZXJyb3JzPzogc2NoZW1hLlNjaGVtYVZhbGlkYXRvckVycm9yW10pIHtcbiAgICBzdXBlcihlcnJvcnMsICdKb2IgSW5ib3VuZCBNZXNzYWdlIGZhaWxlZCB0byB2YWxpZGF0ZS4gRXJyb3JzOiAnKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEpvYk91dHB1dFNjaGVtYVZhbGlkYXRpb25FcnJvciBleHRlbmRzIHNjaGVtYS5TY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoZXJyb3JzPzogc2NoZW1hLlNjaGVtYVZhbGlkYXRvckVycm9yW10pIHtcbiAgICBzdXBlcihlcnJvcnMsICdKb2IgT3V0cHV0IGZhaWxlZCB0byB2YWxpZGF0ZS4gRXJyb3JzOiAnKTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgSm9iSGFuZGxlcldpdGhFeHRyYSBleHRlbmRzIEpvYkhhbmRsZXI8SnNvblZhbHVlLCBKc29uVmFsdWUsIEpzb25WYWx1ZT4ge1xuICBqb2JEZXNjcmlwdGlvbjogSm9iRGVzY3JpcHRpb247XG5cbiAgYXJndW1lbnRWOiBPYnNlcnZhYmxlPHNjaGVtYS5TY2hlbWFWYWxpZGF0b3I+O1xuICBvdXRwdXRWOiBPYnNlcnZhYmxlPHNjaGVtYS5TY2hlbWFWYWxpZGF0b3I+O1xuICBpbnB1dFY6IE9ic2VydmFibGU8c2NoZW1hLlNjaGVtYVZhbGlkYXRvcj47XG59XG5cbmZ1bmN0aW9uIF9qb2JTaGFyZTxUPigpOiBNb25vVHlwZU9wZXJhdG9yRnVuY3Rpb248VD4ge1xuICAvLyBUaGlzIGlzIHRoZSBzYW1lIGNvZGUgYXMgYSBgc2hhcmVSZXBsYXkoKWAgb3BlcmF0b3IsIGJ1dCB1c2VzIGEgZHVtYmVyIFN1YmplY3QgcmF0aGVyIHRoYW4gYVxuICAvLyBSZXBsYXlTdWJqZWN0LlxuICByZXR1cm4gKHNvdXJjZTogT2JzZXJ2YWJsZTxUPik6IE9ic2VydmFibGU8VD4gPT4ge1xuICAgIGxldCByZWZDb3VudCA9IDA7XG4gICAgbGV0IHN1YmplY3Q6IFN1YmplY3Q8VD47XG4gICAgbGV0IGhhc0Vycm9yID0gZmFsc2U7XG4gICAgbGV0IGlzQ29tcGxldGUgPSBmYWxzZTtcbiAgICBsZXQgc3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb247XG5cbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8VD4oKHN1YnNjcmliZXIpID0+IHtcbiAgICAgIGxldCBpbm5lclN1YjogU3Vic2NyaXB0aW9uO1xuICAgICAgcmVmQ291bnQrKztcbiAgICAgIGlmICghc3ViamVjdCkge1xuICAgICAgICBzdWJqZWN0ID0gbmV3IFN1YmplY3Q8VD4oKTtcblxuICAgICAgICBpbm5lclN1YiA9IHN1YmplY3Quc3Vic2NyaWJlKHN1YnNjcmliZXIpO1xuICAgICAgICBzdWJzY3JpcHRpb24gPSBzb3VyY2Uuc3Vic2NyaWJlKHtcbiAgICAgICAgICBuZXh0KHZhbHVlKSB7XG4gICAgICAgICAgICBzdWJqZWN0Lm5leHQodmFsdWUpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZXJyb3IoZXJyKSB7XG4gICAgICAgICAgICBoYXNFcnJvciA9IHRydWU7XG4gICAgICAgICAgICBzdWJqZWN0LmVycm9yKGVycik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21wbGV0ZSgpIHtcbiAgICAgICAgICAgIGlzQ29tcGxldGUgPSB0cnVlO1xuICAgICAgICAgICAgc3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5uZXJTdWIgPSBzdWJqZWN0LnN1YnNjcmliZShzdWJzY3JpYmVyKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgcmVmQ291bnQtLTtcbiAgICAgICAgaW5uZXJTdWIudW5zdWJzY3JpYmUoKTtcbiAgICAgICAgaWYgKHN1YnNjcmlwdGlvbiAmJiByZWZDb3VudCA9PT0gMCAmJiAoaXNDb21wbGV0ZSB8fCBoYXNFcnJvcikpIHtcbiAgICAgICAgICBzdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfTtcbn1cblxuLyoqXG4gKiBTaW1wbGUgc2NoZWR1bGVyLiBTaG91bGQgYmUgdGhlIGJhc2Ugb2YgYWxsIHJlZ2lzdHJpZXMgYW5kIHNjaGVkdWxlcnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTaW1wbGVTY2hlZHVsZXI8XG4gIE1pbmltdW1Bcmd1bWVudFQgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gIE1pbmltdW1JbnB1dFQgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4gIE1pbmltdW1PdXRwdXRUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlXG4+IGltcGxlbWVudHMgU2NoZWR1bGVyPE1pbmltdW1Bcmd1bWVudFQsIE1pbmltdW1JbnB1dFQsIE1pbmltdW1PdXRwdXRUPiB7XG4gIHByaXZhdGUgX2ludGVybmFsSm9iRGVzY3JpcHRpb25NYXAgPSBuZXcgTWFwPEpvYk5hbWUsIEpvYkhhbmRsZXJXaXRoRXh0cmE+KCk7XG4gIHByaXZhdGUgX3F1ZXVlOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICBwcml2YXRlIF9wYXVzZUNvdW50ZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBfam9iUmVnaXN0cnk6IFJlZ2lzdHJ5PE1pbmltdW1Bcmd1bWVudFQsIE1pbmltdW1JbnB1dFQsIE1pbmltdW1PdXRwdXRUPixcbiAgICBwcm90ZWN0ZWQgX3NjaGVtYVJlZ2lzdHJ5OiBzY2hlbWEuU2NoZW1hUmVnaXN0cnkgPSBuZXcgc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeSgpLFxuICApIHt9XG5cbiAgcHJpdmF0ZSBfZ2V0SW50ZXJuYWxEZXNjcmlwdGlvbihuYW1lOiBKb2JOYW1lKTogT2JzZXJ2YWJsZTxKb2JIYW5kbGVyV2l0aEV4dHJhIHwgbnVsbD4ge1xuICAgIGNvbnN0IG1heWJlSGFuZGxlciA9IHRoaXMuX2ludGVybmFsSm9iRGVzY3JpcHRpb25NYXAuZ2V0KG5hbWUpO1xuICAgIGlmIChtYXliZUhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG9mKG1heWJlSGFuZGxlcik7XG4gICAgfVxuXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMuX2pvYlJlZ2lzdHJ5LmdldDxNaW5pbXVtQXJndW1lbnRULCBNaW5pbXVtSW5wdXRULCBNaW5pbXVtT3V0cHV0VD4obmFtZSk7XG5cbiAgICByZXR1cm4gaGFuZGxlci5waXBlKFxuICAgICAgc3dpdGNoTWFwKChoYW5kbGVyKSA9PiB7XG4gICAgICAgIGlmIChoYW5kbGVyID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG9mKG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVzY3JpcHRpb246IEpvYkRlc2NyaXB0aW9uID0ge1xuICAgICAgICAgIC8vIE1ha2UgYSBjb3B5IG9mIGl0IHRvIGJlIHN1cmUgaXQncyBwcm9wZXIgSlNPTi5cbiAgICAgICAgICAuLi5KU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGhhbmRsZXIuam9iRGVzY3JpcHRpb24pKSxcbiAgICAgICAgICBuYW1lOiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLm5hbWUgfHwgbmFtZSxcbiAgICAgICAgICBhcmd1bWVudDogaGFuZGxlci5qb2JEZXNjcmlwdGlvbi5hcmd1bWVudCB8fCB0cnVlLFxuICAgICAgICAgIGlucHV0OiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLmlucHV0IHx8IHRydWUsXG4gICAgICAgICAgb3V0cHV0OiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLm91dHB1dCB8fCB0cnVlLFxuICAgICAgICAgIGNoYW5uZWxzOiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLmNoYW5uZWxzIHx8IHt9LFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGhhbmRsZXJXaXRoRXh0cmEgPSBPYmplY3QuYXNzaWduKGhhbmRsZXIuYmluZCh1bmRlZmluZWQpLCB7XG4gICAgICAgICAgam9iRGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuICAgICAgICAgIGFyZ3VtZW50VjogdGhpcy5fc2NoZW1hUmVnaXN0cnkuY29tcGlsZShkZXNjcmlwdGlvbi5hcmd1bWVudCkucGlwZShzaGFyZVJlcGxheSgxKSksXG4gICAgICAgICAgaW5wdXRWOiB0aGlzLl9zY2hlbWFSZWdpc3RyeS5jb21waWxlKGRlc2NyaXB0aW9uLmlucHV0KS5waXBlKHNoYXJlUmVwbGF5KDEpKSxcbiAgICAgICAgICBvdXRwdXRWOiB0aGlzLl9zY2hlbWFSZWdpc3RyeS5jb21waWxlKGRlc2NyaXB0aW9uLm91dHB1dCkucGlwZShzaGFyZVJlcGxheSgxKSksXG4gICAgICAgIH0pIGFzIEpvYkhhbmRsZXJXaXRoRXh0cmE7XG4gICAgICAgIHRoaXMuX2ludGVybmFsSm9iRGVzY3JpcHRpb25NYXAuc2V0KG5hbWUsIGhhbmRsZXJXaXRoRXh0cmEpO1xuXG4gICAgICAgIHJldHVybiBvZihoYW5kbGVyV2l0aEV4dHJhKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgam9iIGRlc2NyaXB0aW9uIGZvciBhIG5hbWVkIGpvYi5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgVGhlIG5hbWUgb2YgdGhlIGpvYi5cbiAgICogQHJldHVybnMgQSBkZXNjcmlwdGlvbiwgb3IgbnVsbCBpZiB0aGUgam9iIGlzIG5vdCByZWdpc3RlcmVkLlxuICAgKi9cbiAgZ2V0RGVzY3JpcHRpb24obmFtZTogSm9iTmFtZSkge1xuICAgIHJldHVybiBjb25jYXQoXG4gICAgICB0aGlzLl9nZXRJbnRlcm5hbERlc2NyaXB0aW9uKG5hbWUpLnBpcGUobWFwKCh4KSA9PiB4ICYmIHguam9iRGVzY3JpcHRpb24pKSxcbiAgICAgIG9mKG51bGwpLFxuICAgICkucGlwZShmaXJzdCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGpvYiBuYW1lIGhhcyBiZWVuIHJlZ2lzdGVyZWQuXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBqb2IuXG4gICAqIEByZXR1cm5zIFRydWUgaWYgdGhlIGpvYiBleGlzdHMsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIGhhcyhuYW1lOiBKb2JOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RGVzY3JpcHRpb24obmFtZSkucGlwZShtYXAoKHgpID0+IHggIT09IG51bGwpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXVzZSB0aGUgc2NoZWR1bGVyLCB0ZW1wb3JhcnkgcXVldWVpbmcgX25ld18gam9icy4gUmV0dXJucyBhIHJlc3VtZSBmdW5jdGlvbiB0aGF0IHNob3VsZCBiZVxuICAgKiB1c2VkIHRvIHJlc3VtZSBleGVjdXRpb24uIElmIG11bHRpcGxlIGBwYXVzZSgpYCB3ZXJlIGNhbGxlZCwgYWxsIHRoZWlyIHJlc3VtZSBmdW5jdGlvbnMgbXVzdFxuICAgKiBiZSBjYWxsZWQgYmVmb3JlIHRoZSBTY2hlZHVsZXIgYWN0dWFsbHkgc3RhcnRzIG5ldyBqb2JzLiBBZGRpdGlvbmFsIGNhbGxzIHRvIHRoZSBzYW1lIHJlc3VtZVxuICAgKiBmdW5jdGlvbiB3aWxsIGhhdmUgbm8gZWZmZWN0LlxuICAgKlxuICAgKiBKb2JzIGFscmVhZHkgcnVubmluZyBhcmUgTk9UIHBhdXNlZC4gVGhpcyBpcyBwYXVzaW5nIHRoZSBzY2hlZHVsZXIgb25seS5cbiAgICovXG4gIHBhdXNlKCkge1xuICAgIGxldCBjYWxsZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wYXVzZUNvdW50ZXIrKztcblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBpZiAoLS10aGlzLl9wYXVzZUNvdW50ZXIgPT0gMCkge1xuICAgICAgICAgIC8vIFJlc3VtZSB0aGUgcXVldWUuXG4gICAgICAgICAgY29uc3QgcSA9IHRoaXMuX3F1ZXVlO1xuICAgICAgICAgIHRoaXMuX3F1ZXVlID0gW107XG4gICAgICAgICAgcS5mb3JFYWNoKChmbikgPT4gZm4oKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlIGEgam9iIHRvIGJlIHJ1biwgdXNpbmcgaXRzIG5hbWUuXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lIG9mIGpvYiB0byBiZSBydW4uXG4gICAqIEBwYXJhbSBhcmd1bWVudCBUaGUgYXJndW1lbnQgdG8gc2VuZCB0byB0aGUgam9iIHdoZW4gc3RhcnRpbmcgaXQuXG4gICAqIEBwYXJhbSBvcHRpb25zIFNjaGVkdWxpbmcgb3B0aW9ucy5cbiAgICogQHJldHVybnMgVGhlIEpvYiBiZWluZyBydW4uXG4gICAqL1xuICBzY2hlZHVsZTxBIGV4dGVuZHMgTWluaW11bUFyZ3VtZW50VCwgSSBleHRlbmRzIE1pbmltdW1JbnB1dFQsIE8gZXh0ZW5kcyBNaW5pbXVtT3V0cHV0VD4oXG4gICAgbmFtZTogSm9iTmFtZSxcbiAgICBhcmd1bWVudDogQSxcbiAgICBvcHRpb25zPzogU2NoZWR1bGVKb2JPcHRpb25zLFxuICApOiBKb2I8QSwgSSwgTz4ge1xuICAgIGlmICh0aGlzLl9wYXVzZUNvdW50ZXIgPiAwKSB7XG4gICAgICBjb25zdCB3YWl0YWJsZSA9IG5ldyBTdWJqZWN0PG5ldmVyPigpO1xuICAgICAgdGhpcy5fcXVldWUucHVzaCgoKSA9PiB3YWl0YWJsZS5jb21wbGV0ZSgpKTtcblxuICAgICAgcmV0dXJuIHRoaXMuX3NjaGVkdWxlSm9iPEEsIEksIE8+KG5hbWUsIGFyZ3VtZW50LCBvcHRpb25zIHx8IHt9LCB3YWl0YWJsZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3NjaGVkdWxlSm9iPEEsIEksIE8+KG5hbWUsIGFyZ3VtZW50LCBvcHRpb25zIHx8IHt9LCBFTVBUWSk7XG4gIH1cblxuICAvKipcbiAgICogRmlsdGVyIG1lc3NhZ2VzLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBfZmlsdGVySm9iT3V0Ym91bmRNZXNzYWdlczxPIGV4dGVuZHMgTWluaW11bU91dHB1dFQ+KFxuICAgIG1lc3NhZ2U6IEpvYk91dGJvdW5kTWVzc2FnZTxPPixcbiAgICBzdGF0ZTogSm9iU3RhdGUsXG4gICkge1xuICAgIHN3aXRjaCAobWVzc2FnZS5raW5kKSB7XG4gICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuT25SZWFkeTpcbiAgICAgICAgcmV0dXJuIHN0YXRlID09IEpvYlN0YXRlLlF1ZXVlZDtcbiAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5TdGFydDpcbiAgICAgICAgcmV0dXJuIHN0YXRlID09IEpvYlN0YXRlLlJlYWR5O1xuXG4gICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuRW5kOlxuICAgICAgICByZXR1cm4gc3RhdGUgPT0gSm9iU3RhdGUuU3RhcnRlZCB8fCBzdGF0ZSA9PSBKb2JTdGF0ZS5SZWFkeTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBuZXcgc3RhdGUuIFRoaXMgaXMganVzdCB0byBzaW1wbGlmeSB0aGUgcmVhZGluZyBvZiB0aGUgX2NyZWF0ZUpvYiBtZXRob2QuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVTdGF0ZTxPIGV4dGVuZHMgTWluaW11bU91dHB1dFQ+KFxuICAgIG1lc3NhZ2U6IEpvYk91dGJvdW5kTWVzc2FnZTxPPixcbiAgICBzdGF0ZTogSm9iU3RhdGUsXG4gICk6IEpvYlN0YXRlIHtcbiAgICBzd2l0Y2ggKG1lc3NhZ2Uua2luZCkge1xuICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk9uUmVhZHk6XG4gICAgICAgIHJldHVybiBKb2JTdGF0ZS5SZWFkeTtcbiAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5TdGFydDpcbiAgICAgICAgcmV0dXJuIEpvYlN0YXRlLlN0YXJ0ZWQ7XG4gICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuRW5kOlxuICAgICAgICByZXR1cm4gSm9iU3RhdGUuRW5kZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSB0aGUgam9iLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRlSm9iPEEgZXh0ZW5kcyBNaW5pbXVtQXJndW1lbnRULCBJIGV4dGVuZHMgTWluaW11bUlucHV0VCwgTyBleHRlbmRzIE1pbmltdW1PdXRwdXRUPihcbiAgICBuYW1lOiBKb2JOYW1lLFxuICAgIGFyZ3VtZW50OiBBLFxuICAgIGhhbmRsZXI6IE9ic2VydmFibGU8Sm9iSGFuZGxlcldpdGhFeHRyYSB8IG51bGw+LFxuICAgIGluYm91bmRCdXM6IE9ic2VydmVyPEpvYkluYm91bmRNZXNzYWdlPEk+PixcbiAgICBvdXRib3VuZEJ1czogT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+LFxuICApOiBKb2I8QSwgSSwgTz4ge1xuICAgIGNvbnN0IHNjaGVtYVJlZ2lzdHJ5ID0gdGhpcy5fc2NoZW1hUmVnaXN0cnk7XG5cbiAgICBjb25zdCBjaGFubmVsc1N1YmplY3QgPSBuZXcgTWFwPHN0cmluZywgU3ViamVjdDxKc29uVmFsdWU+PigpO1xuICAgIGNvbnN0IGNoYW5uZWxzID0gbmV3IE1hcDxzdHJpbmcsIE9ic2VydmFibGU8SnNvblZhbHVlPj4oKTtcblxuICAgIGxldCBzdGF0ZSA9IEpvYlN0YXRlLlF1ZXVlZDtcbiAgICBsZXQgcGluZ0lkID0gMDtcblxuICAgIC8vIENyZWF0ZSB0aGUgaW5wdXQgY2hhbm5lbCBieSBoYXZpbmcgYSBmaWx0ZXIuXG4gICAgY29uc3QgaW5wdXQgPSBuZXcgU3ViamVjdDxKc29uVmFsdWU+KCk7XG4gICAgaW5wdXRcbiAgICAgIC5waXBlKFxuICAgICAgICBjb25jYXRNYXAoKG1lc3NhZ2UpID0+XG4gICAgICAgICAgaGFuZGxlci5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKChoYW5kbGVyKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChoYW5kbGVyID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEpvYkRvZXNOb3RFeGlzdEV4Y2VwdGlvbihuYW1lKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlci5pbnB1dFYucGlwZShzd2l0Y2hNYXAoKHZhbGlkYXRlKSA9PiB2YWxpZGF0ZShtZXNzYWdlKSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApLFxuICAgICAgICApLFxuICAgICAgICBmaWx0ZXIoKHJlc3VsdCkgPT4gcmVzdWx0LnN1Y2Nlc3MpLFxuICAgICAgICBtYXAoKHJlc3VsdCkgPT4gcmVzdWx0LmRhdGEgYXMgSSksXG4gICAgICApXG4gICAgICAuc3Vic2NyaWJlKCh2YWx1ZSkgPT4gaW5ib3VuZEJ1cy5uZXh0KHsga2luZDogSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLklucHV0LCB2YWx1ZSB9KSk7XG5cbiAgICBvdXRib3VuZEJ1cyA9IGNvbmNhdChcbiAgICAgIG91dGJvdW5kQnVzLFxuICAgICAgLy8gQWRkIGFuIEVuZCBtZXNzYWdlIGF0IGNvbXBsZXRpb24uIFRoaXMgd2lsbCBiZSBmaWx0ZXJlZCBvdXQgaWYgdGhlIGpvYiBhY3R1YWxseSBzZW5kIGFuXG4gICAgICAvLyBFbmQuXG4gICAgICBoYW5kbGVyLnBpcGUoXG4gICAgICAgIHN3aXRjaE1hcCgoaGFuZGxlcikgPT4ge1xuICAgICAgICAgIGlmIChoYW5kbGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gb2Y8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+Pih7XG4gICAgICAgICAgICAgIGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuRW5kLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogaGFuZGxlci5qb2JEZXNjcmlwdGlvbixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gRU1QVFkgYXMgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+O1xuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICApLFxuICAgICkucGlwZShcbiAgICAgIGZpbHRlcigobWVzc2FnZSkgPT4gdGhpcy5fZmlsdGVySm9iT3V0Ym91bmRNZXNzYWdlcyhtZXNzYWdlLCBzdGF0ZSkpLFxuICAgICAgLy8gVXBkYXRlIGludGVybmFsIGxvZ2ljIGFuZCBKb2I8PiBtZW1iZXJzLlxuICAgICAgdGFwKFxuICAgICAgICAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc3RhdGUuXG4gICAgICAgICAgc3RhdGUgPSB0aGlzLl91cGRhdGVTdGF0ZShtZXNzYWdlLCBzdGF0ZSk7XG5cbiAgICAgICAgICBzd2l0Y2ggKG1lc3NhZ2Uua2luZCkge1xuICAgICAgICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkNoYW5uZWxDcmVhdGU6IHtcbiAgICAgICAgICAgICAgY29uc3QgbWF5YmVTdWJqZWN0ID0gY2hhbm5lbHNTdWJqZWN0LmdldChtZXNzYWdlLm5hbWUpO1xuICAgICAgICAgICAgICAvLyBJZiBpdCBkb2Vzbid0IGV4aXN0IG9yIGl0J3MgY2xvc2VkIG9uIHRoZSBvdGhlciBlbmQuXG4gICAgICAgICAgICAgIGlmICghbWF5YmVTdWJqZWN0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcyA9IG5ldyBTdWJqZWN0PEpzb25WYWx1ZT4oKTtcbiAgICAgICAgICAgICAgICBjaGFubmVsc1N1YmplY3Quc2V0KG1lc3NhZ2UubmFtZSwgcyk7XG4gICAgICAgICAgICAgICAgY2hhbm5lbHMuc2V0KG1lc3NhZ2UubmFtZSwgcy5hc09ic2VydmFibGUoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5DaGFubmVsTWVzc2FnZToge1xuICAgICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICAgIGlmIChtYXliZVN1YmplY3QpIHtcbiAgICAgICAgICAgICAgICBtYXliZVN1YmplY3QubmV4dChtZXNzYWdlLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbENvbXBsZXRlOiB7XG4gICAgICAgICAgICAgIGNvbnN0IG1heWJlU3ViamVjdCA9IGNoYW5uZWxzU3ViamVjdC5nZXQobWVzc2FnZS5uYW1lKTtcbiAgICAgICAgICAgICAgaWYgKG1heWJlU3ViamVjdCkge1xuICAgICAgICAgICAgICAgIG1heWJlU3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICAgIGNoYW5uZWxzU3ViamVjdC5kZWxldGUobWVzc2FnZS5uYW1lKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkNoYW5uZWxFcnJvcjoge1xuICAgICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICAgIGlmIChtYXliZVN1YmplY3QpIHtcbiAgICAgICAgICAgICAgICBtYXliZVN1YmplY3QuZXJyb3IobWVzc2FnZS5lcnJvcik7XG4gICAgICAgICAgICAgICAgY2hhbm5lbHNTdWJqZWN0LmRlbGV0ZShtZXNzYWdlLm5hbWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIHN0YXRlID0gSm9iU3RhdGUuRXJyb3JlZDtcbiAgICAgICAgfSxcbiAgICAgICksXG5cbiAgICAgIC8vIERvIG91dHB1dCB2YWxpZGF0aW9uIChtaWdodCBpbmNsdWRlIGRlZmF1bHQgdmFsdWVzIHNvIHRoaXMgbWlnaHQgaGF2ZSBzaWRlXG4gICAgICAvLyBlZmZlY3RzKS4gV2Uga2VlcCBhbGwgbWVzc2FnZXMgaW4gb3JkZXIuXG4gICAgICBjb25jYXRNYXAoKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgaWYgKG1lc3NhZ2Uua2luZCAhPT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5PdXRwdXQpIHtcbiAgICAgICAgICByZXR1cm4gb2YobWVzc2FnZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaGFuZGxlci5waXBlKFxuICAgICAgICAgIHN3aXRjaE1hcCgoaGFuZGxlcikgPT4ge1xuICAgICAgICAgICAgaWYgKGhhbmRsZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEpvYkRvZXNOb3RFeGlzdEV4Y2VwdGlvbihuYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLm91dHB1dFYucGlwZShcbiAgICAgICAgICAgICAgICBzd2l0Y2hNYXAoKHZhbGlkYXRlKSA9PiB2YWxpZGF0ZShtZXNzYWdlLnZhbHVlKSksXG4gICAgICAgICAgICAgICAgc3dpdGNoTWFwKChvdXRwdXQpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmICghb3V0cHV0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEpvYk91dHB1dFNjaGVtYVZhbGlkYXRpb25FcnJvcihvdXRwdXQuZXJyb3JzKTtcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgcmV0dXJuIG9mKHtcbiAgICAgICAgICAgICAgICAgICAgLi4ubWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0OiBvdXRwdXQuZGF0YSBhcyBPLFxuICAgICAgICAgICAgICAgICAgfSBhcyBKb2JPdXRib3VuZE1lc3NhZ2VPdXRwdXQ8Tz4pO1xuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgICApIGFzIE9ic2VydmFibGU8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+PjtcbiAgICAgIH0pLFxuICAgICAgX2pvYlNoYXJlKCksXG4gICAgKTtcblxuICAgIGNvbnN0IG91dHB1dCA9IG91dGJvdW5kQnVzLnBpcGUoXG4gICAgICBmaWx0ZXIoKHgpID0+IHgua2luZCA9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk91dHB1dCksXG4gICAgICBtYXAoKHgpID0+ICh4IGFzIEpvYk91dGJvdW5kTWVzc2FnZU91dHB1dDxPPikudmFsdWUpLFxuICAgICAgc2hhcmVSZXBsYXkoMSksXG4gICAgKTtcblxuICAgIC8vIFJldHVybiB0aGUgSm9iLlxuICAgIHJldHVybiB7XG4gICAgICBnZXQgc3RhdGUoKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgIH0sXG4gICAgICBhcmd1bWVudCxcbiAgICAgIGRlc2NyaXB0aW9uOiBoYW5kbGVyLnBpcGUoXG4gICAgICAgIHN3aXRjaE1hcCgoaGFuZGxlcikgPT4ge1xuICAgICAgICAgIGlmIChoYW5kbGVyID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSm9iRG9lc05vdEV4aXN0RXhjZXB0aW9uKG5hbWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gb2YoaGFuZGxlci5qb2JEZXNjcmlwdGlvbik7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgICBvdXRwdXQsXG4gICAgICBnZXRDaGFubmVsPFQgZXh0ZW5kcyBKc29uVmFsdWU+KFxuICAgICAgICBuYW1lOiBKb2JOYW1lLFxuICAgICAgICBzY2hlbWE6IHNjaGVtYS5Kc29uU2NoZW1hID0gdHJ1ZSxcbiAgICAgICk6IE9ic2VydmFibGU8VD4ge1xuICAgICAgICBsZXQgbWF5YmVPYnNlcnZhYmxlID0gY2hhbm5lbHMuZ2V0KG5hbWUpO1xuICAgICAgICBpZiAoIW1heWJlT2JzZXJ2YWJsZSkge1xuICAgICAgICAgIGNvbnN0IHMgPSBuZXcgU3ViamVjdDxUPigpO1xuICAgICAgICAgIGNoYW5uZWxzU3ViamVjdC5zZXQobmFtZSwgKHMgYXMgdW5rbm93bikgYXMgU3ViamVjdDxKc29uVmFsdWU+KTtcbiAgICAgICAgICBjaGFubmVscy5zZXQobmFtZSwgcy5hc09ic2VydmFibGUoKSk7XG5cbiAgICAgICAgICBtYXliZU9ic2VydmFibGUgPSBzLmFzT2JzZXJ2YWJsZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1heWJlT2JzZXJ2YWJsZS5waXBlKFxuICAgICAgICAgIC8vIEtlZXAgdGhlIG9yZGVyIG9mIG1lc3NhZ2VzLlxuICAgICAgICAgIGNvbmNhdE1hcCgobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNjaGVtYVJlZ2lzdHJ5LmNvbXBpbGUoc2NoZW1hKS5waXBlKFxuICAgICAgICAgICAgICBzd2l0Y2hNYXAoKHZhbGlkYXRlKSA9PiB2YWxpZGF0ZShtZXNzYWdlKSksXG4gICAgICAgICAgICAgIGZpbHRlcigoeCkgPT4geC5zdWNjZXNzKSxcbiAgICAgICAgICAgICAgbWFwKCh4KSA9PiB4LmRhdGEgYXMgVCksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIHBpbmcoKSB7XG4gICAgICAgIGNvbnN0IGlkID0gcGluZ0lkKys7XG4gICAgICAgIGluYm91bmRCdXMubmV4dCh7IGtpbmQ6IEpvYkluYm91bmRNZXNzYWdlS2luZC5QaW5nLCBpZCB9KTtcblxuICAgICAgICByZXR1cm4gb3V0Ym91bmRCdXMucGlwZShcbiAgICAgICAgICBmaWx0ZXIoKHgpID0+IHgua2luZCA9PT0gSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5Qb25nICYmIHguaWQgPT0gaWQpLFxuICAgICAgICAgIGZpcnN0KCksXG4gICAgICAgICAgaWdub3JlRWxlbWVudHMoKSxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBzdG9wKCkge1xuICAgICAgICBpbmJvdW5kQnVzLm5leHQoeyBraW5kOiBKb2JJbmJvdW5kTWVzc2FnZUtpbmQuU3RvcCB9KTtcbiAgICAgIH0sXG4gICAgICBpbnB1dCxcbiAgICAgIGluYm91bmRCdXMsXG4gICAgICBvdXRib3VuZEJ1cyxcbiAgICB9O1xuICB9XG5cbiAgcHJvdGVjdGVkIF9zY2hlZHVsZUpvYjxcbiAgICBBIGV4dGVuZHMgTWluaW11bUFyZ3VtZW50VCxcbiAgICBJIGV4dGVuZHMgTWluaW11bUlucHV0VCxcbiAgICBPIGV4dGVuZHMgTWluaW11bU91dHB1dFRcbiAgPihcbiAgICBuYW1lOiBKb2JOYW1lLFxuICAgIGFyZ3VtZW50OiBBLFxuICAgIG9wdGlvbnM6IFNjaGVkdWxlSm9iT3B0aW9ucyxcbiAgICB3YWl0YWJsZTogT2JzZXJ2YWJsZTxuZXZlcj4sXG4gICk6IEpvYjxBLCBJLCBPPiB7XG4gICAgLy8gR2V0IGhhbmRsZXIgZmlyc3QsIHNpbmNlIHRoaXMgY2FuIGVycm9yIG91dCBpZiB0aGVyZSdzIG5vIGhhbmRsZXIgZm9yIHRoZSBqb2IgbmFtZS5cbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fZ2V0SW50ZXJuYWxEZXNjcmlwdGlvbihuYW1lKTtcblxuICAgIGNvbnN0IG9wdGlvbnNEZXBzID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXBlbmRlbmNpZXMpIHx8IFtdO1xuICAgIGNvbnN0IGRlcGVuZGVuY2llcyA9IEFycmF5LmlzQXJyYXkob3B0aW9uc0RlcHMpID8gb3B0aW9uc0RlcHMgOiBbb3B0aW9uc0RlcHNdO1xuXG4gICAgY29uc3QgaW5ib3VuZEJ1cyA9IG5ldyBTdWJqZWN0PEpvYkluYm91bmRNZXNzYWdlPEk+PigpO1xuICAgIGNvbnN0IG91dGJvdW5kQnVzID0gY29uY2F0KFxuICAgICAgLy8gV2FpdCBmb3IgZGVwZW5kZW5jaWVzLCBtYWtlIHN1cmUgdG8gbm90IHJlcG9ydCBtZXNzYWdlcyBmcm9tIGRlcGVuZGVuY2llcy4gU3Vic2NyaWJlIHRvXG4gICAgICAvLyBhbGwgZGVwZW5kZW5jaWVzIGF0IHRoZSBzYW1lIHRpbWUgc28gdGhleSBydW4gY29uY3VycmVudGx5LlxuICAgICAgbWVyZ2UoLi4uZGVwZW5kZW5jaWVzLm1hcCgoeCkgPT4geC5vdXRib3VuZEJ1cykpLnBpcGUoaWdub3JlRWxlbWVudHMoKSksXG5cbiAgICAgIC8vIFdhaXQgZm9yIHBhdXNlKCkgdG8gY2xlYXIgKGlmIG5lY2Vzc2FyeSkuXG4gICAgICB3YWl0YWJsZSxcblxuICAgICAgZnJvbShoYW5kbGVyKS5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoXG4gICAgICAgICAgKGhhbmRsZXIpID0+XG4gICAgICAgICAgICBuZXcgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+KChzdWJzY3JpYmVyOiBPYnNlcnZlcjxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+KSA9PiB7XG4gICAgICAgICAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBKb2JEb2VzTm90RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSB0aGUgYXJndW1lbnQuXG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLmFyZ3VtZW50VlxuICAgICAgICAgICAgICAgIC5waXBlKFxuICAgICAgICAgICAgICAgICAgc3dpdGNoTWFwKCh2YWxpZGF0ZSkgPT4gdmFsaWRhdGUoYXJndW1lbnQpKSxcbiAgICAgICAgICAgICAgICAgIHN3aXRjaE1hcCgob3V0cHV0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghb3V0cHV0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSm9iQXJndW1lbnRTY2hlbWFWYWxpZGF0aW9uRXJyb3Iob3V0cHV0LmVycm9ycyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBhcmd1bWVudDogQSA9IG91dHB1dC5kYXRhIGFzIEE7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gaGFuZGxlci5qb2JEZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgc3Vic2NyaWJlci5uZXh0KHsga2luZDogSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5PblJlYWR5LCBkZXNjcmlwdGlvbiB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0ID0ge1xuICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgIGRlcGVuZGVuY2llczogWy4uLmRlcGVuZGVuY2llc10sXG4gICAgICAgICAgICAgICAgICAgICAgaW5ib3VuZEJ1czogaW5ib3VuZEJ1cy5hc09ic2VydmFibGUoKSxcbiAgICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZXI6IHRoaXMgYXMgU2NoZWR1bGVyPE1pbmltdW1Bcmd1bWVudFQsIE1pbmltdW1JbnB1dFQsIE1pbmltdW1PdXRwdXRUPixcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlcihhcmd1bWVudCwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgLnN1YnNjcmliZShzdWJzY3JpYmVyIGFzIE9ic2VydmVyPEpvYk91dGJvdW5kTWVzc2FnZTxKc29uVmFsdWU+Pik7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKSxcbiAgICAgICksXG4gICAgKTtcblxuICAgIHJldHVybiB0aGlzLl9jcmVhdGVKb2IobmFtZSwgYXJndW1lbnQsIGhhbmRsZXIsIGluYm91bmRCdXMsIG91dGJvdW5kQnVzKTtcbiAgfVxufVxuIl19