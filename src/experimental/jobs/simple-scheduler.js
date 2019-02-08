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
const json_1 = require("../../json");
const logger_1 = require("../../logger");
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
        return new rxjs_1.Observable(subscriber => {
            let innerSub;
            refCount++;
            if (!subject) {
                subject = new rxjs_1.Subject();
                innerSub = subject.subscribe(subscriber);
                subscription = source.subscribe({
                    next(value) { subject.next(value); },
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
            return rxjs_1.of(maybeHandler);
        }
        const handler = this._jobRegistry.get(name);
        return handler.pipe(operators_1.switchMap(handler => {
            if (handler === null) {
                return rxjs_1.of(null);
            }
            const description = Object.assign({}, JSON.parse(JSON.stringify(handler.jobDescription)), { name: handler.jobDescription.name || name, argument: handler.jobDescription.argument || true, input: handler.jobDescription.input || true, output: handler.jobDescription.output || true, channels: handler.jobDescription.channels || {} });
            const handlerWithExtra = Object.assign(handler.bind(undefined), {
                jobDescription: description,
                argumentV: this._schemaRegistry.compile(description.argument).pipe(operators_1.shareReplay(1)),
                inputV: this._schemaRegistry.compile(description.input).pipe(operators_1.shareReplay(1)),
                outputV: this._schemaRegistry.compile(description.output).pipe(operators_1.shareReplay(1)),
            });
            this._internalJobDescriptionMap.set(name, handlerWithExtra);
            return rxjs_1.of(handlerWithExtra);
        }));
    }
    /**
     * Get a job description for a named job.
     *
     * @param name The name of the job.
     * @returns A description, or null if the job is not registered.
     */
    getDescription(name) {
        return rxjs_1.concat(this._getInternalDescription(name).pipe(operators_1.map(x => x && x.jobDescription)), rxjs_1.of(null)).pipe(operators_1.first());
    }
    /**
     * Returns true if the job name has been registered.
     * @param name The name of the job.
     * @returns True if the job exists, false otherwise.
     */
    has(name) {
        return this.getDescription(name).pipe(operators_1.map(x => x !== null));
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
                    q.forEach(fn => fn());
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
    _createJob(name, argument, handler, inboundBus, outboundBus, options) {
        const schemaRegistry = this._schemaRegistry;
        const channelsSubject = new Map();
        const channels = new Map();
        let state = api_1.JobState.Queued;
        let pingId = 0;
        const logger = options.logger ? options.logger.createChild('job') : new logger_1.NullLogger();
        // Create the input channel by having a filter.
        const input = new rxjs_1.Subject();
        input.pipe(operators_1.switchMap(message => handler.pipe(operators_1.switchMap(handler => {
            if (handler === null) {
                throw new exception_1.JobDoesNotExistException(name);
            }
            else {
                return handler.inputV.pipe(operators_1.switchMap(validate => validate(message)));
            }
        }))), operators_1.filter(result => result.success), operators_1.map(result => result.data)).subscribe(value => inboundBus.next({ kind: api_1.JobInboundMessageKind.Input, value }));
        outboundBus = rxjs_1.concat(outboundBus, 
        // Add an End message at completion. This will be filtered out if the job actually send an
        // End.
        handler.pipe(operators_1.switchMap(handler => {
            if (handler) {
                return rxjs_1.of({
                    kind: api_1.JobOutboundMessageKind.End, description: handler.jobDescription,
                });
            }
            else {
                return rxjs_1.EMPTY;
            }
        }))).pipe(operators_1.filter(message => this._filterJobOutboundMessages(message, state)), 
        // Update internal logic and Job<> members.
        operators_1.tap(message => {
            // Update the state.
            state = this._updateState(message, state);
            switch (message.kind) {
                case api_1.JobOutboundMessageKind.Log:
                    logger.next(message.entry);
                    break;
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
        operators_1.concatMap(message => {
            if (message.kind !== api_1.JobOutboundMessageKind.Output) {
                return rxjs_1.of(message);
            }
            return handler.pipe(operators_1.switchMap(handler => {
                if (handler === null) {
                    throw new exception_1.JobDoesNotExistException(name);
                }
                else {
                    return handler.outputV.pipe(operators_1.switchMap(validate => validate(message.value)), operators_1.switchMap(output => {
                        if (!output.success) {
                            throw new JobOutputSchemaValidationError(output.errors);
                        }
                        return rxjs_1.of(Object.assign({}, message, { output: output.data }));
                    }));
                }
            }));
        }), _jobShare());
        const output = outboundBus.pipe(operators_1.filter(x => x.kind == api_1.JobOutboundMessageKind.Output), operators_1.map((x) => x.value), operators_1.shareReplay(1));
        // Return the Job.
        return {
            get state() { return state; },
            argument,
            description: handler.pipe(operators_1.switchMap(handler => {
                if (handler === null) {
                    throw new exception_1.JobDoesNotExistException(name);
                }
                else {
                    return rxjs_1.of(handler.jobDescription);
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
                operators_1.concatMap(message => {
                    return schemaRegistry.compile(schema).pipe(operators_1.switchMap(validate => validate(message)), operators_1.filter(x => x.success), operators_1.map(x => x.data));
                }));
            },
            ping() {
                const id = pingId++;
                inboundBus.next({ kind: api_1.JobInboundMessageKind.Ping, id });
                return outboundBus.pipe(operators_1.filter(x => x.kind === api_1.JobOutboundMessageKind.Pong && x.id == id), operators_1.first(), operators_1.ignoreElements());
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
        const outboundBus = rxjs_1.concat(
        // Wait for dependencies, make sure to not report messages from dependencies. Subscribe to
        // all dependencies at the same time so they run concurrently.
        rxjs_1.merge(...dependencies.map(x => x.outboundBus)).pipe(operators_1.ignoreElements()), 
        // Wait for pause() to clear (if necessary).
        waitable, rxjs_1.from(handler).pipe(operators_1.switchMap(handler => new rxjs_1.Observable((subscriber) => {
            if (!handler) {
                throw new exception_1.JobDoesNotExistException(name);
            }
            // Validate the argument.
            return handler.argumentV.pipe(operators_1.switchMap(validate => validate(argument)), operators_1.switchMap(output => {
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
            })).subscribe(subscriber);
        }))));
        return this._createJob(name, argument, handler, inboundBus, outboundBus, options);
    }
}
exports.SimpleScheduler = SimpleScheduler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltcGxlLXNjaGVkdWxlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvZXhwZXJpbWVudGFsL2pvYnMvc2ltcGxlLXNjaGVkdWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtCQVdjO0FBQ2QsOENBU3dCO0FBQ3hCLHFDQUErQztBQUMvQyx5Q0FBMEM7QUFDMUMsK0JBY2U7QUFDZiwyQ0FBdUQ7QUFHdkQsTUFBYSxnQ0FBaUMsU0FBUSxhQUFNLENBQUMseUJBQXlCO0lBQ3BGLFlBQVksTUFBc0M7UUFDaEQsS0FBSyxDQUFDLE1BQU0sRUFBRSwyQ0FBMkMsQ0FBQyxDQUFDO0lBQzdELENBQUM7Q0FDRjtBQUpELDRFQUlDO0FBQ0QsTUFBYSxzQ0FBdUMsU0FBUSxhQUFNLENBQUMseUJBQXlCO0lBQzFGLFlBQVksTUFBc0M7UUFDaEQsS0FBSyxDQUFDLE1BQU0sRUFBRSxrREFBa0QsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7Q0FDRjtBQUpELHdGQUlDO0FBQ0QsTUFBYSw4QkFBK0IsU0FBUSxhQUFNLENBQUMseUJBQXlCO0lBQ2xGLFlBQVksTUFBc0M7UUFDaEQsS0FBSyxDQUFDLE1BQU0sRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO0lBQzNELENBQUM7Q0FDRjtBQUpELHdFQUlDO0FBWUQsU0FBUyxTQUFTO0lBQ2hCLCtGQUErRjtJQUMvRixpQkFBaUI7SUFDakIsT0FBTyxDQUFDLE1BQXFCLEVBQWlCLEVBQUU7UUFDOUMsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLElBQUksT0FBbUIsQ0FBQztRQUN4QixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDckIsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLElBQUksWUFBMEIsQ0FBQztRQUUvQixPQUFPLElBQUksaUJBQVUsQ0FBSSxVQUFVLENBQUMsRUFBRTtZQUNwQyxJQUFJ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RSxPQUFPLENBQUMsQ0FBQztJQUNwRixDQUFDO0NBQ0Y7QUE3YUQsMENBNmFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgRU1QVFksXG4gIE1vbm9UeXBlT3BlcmF0b3JGdW5jdGlvbixcbiAgT2JzZXJ2YWJsZSxcbiAgT2JzZXJ2ZXIsXG4gIFN1YmplY3QsXG4gIFN1YnNjcmlwdGlvbixcbiAgY29uY2F0LFxuICBmcm9tLFxuICBtZXJnZSxcbiAgb2YsXG59IGZyb20gJ3J4anMnO1xuaW1wb3J0IHtcbiAgY29uY2F0TWFwLFxuICBmaWx0ZXIsXG4gIGZpcnN0LFxuICBpZ25vcmVFbGVtZW50cyxcbiAgbWFwLCBzaGFyZSxcbiAgc2hhcmVSZXBsYXksXG4gIHN3aXRjaE1hcCxcbiAgdGFwLFxufSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBKc29uVmFsdWUsIHNjaGVtYSB9IGZyb20gJy4uLy4uL2pzb24nO1xuaW1wb3J0IHsgTnVsbExvZ2dlciB9IGZyb20gJy4uLy4uL2xvZ2dlcic7XG5pbXBvcnQge1xuICBKb2IsXG4gIEpvYkRlc2NyaXB0aW9uLFxuICBKb2JIYW5kbGVyLFxuICBKb2JJbmJvdW5kTWVzc2FnZSxcbiAgSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLFxuICBKb2JOYW1lLFxuICBKb2JPdXRib3VuZE1lc3NhZ2UsXG4gIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQsXG4gIEpvYk91dGJvdW5kTWVzc2FnZU91dHB1dCxcbiAgSm9iU3RhdGUsXG4gIFJlZ2lzdHJ5LFxuICBTY2hlZHVsZUpvYk9wdGlvbnMsXG4gIFNjaGVkdWxlcixcbn0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHsgSm9iRG9lc05vdEV4aXN0RXhjZXB0aW9uIH0gZnJvbSAnLi9leGNlcHRpb24nO1xuXG5cbmV4cG9ydCBjbGFzcyBKb2JBcmd1bWVudFNjaGVtYVZhbGlkYXRpb25FcnJvciBleHRlbmRzIHNjaGVtYS5TY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoZXJyb3JzPzogc2NoZW1hLlNjaGVtYVZhbGlkYXRvckVycm9yW10pIHtcbiAgICBzdXBlcihlcnJvcnMsICdKb2IgQXJndW1lbnQgZmFpbGVkIHRvIHZhbGlkYXRlLiBFcnJvcnM6ICcpO1xuICB9XG59XG5leHBvcnQgY2xhc3MgSm9iSW5ib3VuZE1lc3NhZ2VTY2hlbWFWYWxpZGF0aW9uRXJyb3IgZXh0ZW5kcyBzY2hlbWEuU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKGVycm9ycz86IHNjaGVtYS5TY2hlbWFWYWxpZGF0b3JFcnJvcltdKSB7XG4gICAgc3VwZXIoZXJyb3JzLCAnSm9iIEluYm91bmQgTWVzc2FnZSBmYWlsZWQgdG8gdmFsaWRhdGUuIEVycm9yczogJyk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBKb2JPdXRwdXRTY2hlbWFWYWxpZGF0aW9uRXJyb3IgZXh0ZW5kcyBzY2hlbWEuU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKGVycm9ycz86IHNjaGVtYS5TY2hlbWFWYWxpZGF0b3JFcnJvcltdKSB7XG4gICAgc3VwZXIoZXJyb3JzLCAnSm9iIE91dHB1dCBmYWlsZWQgdG8gdmFsaWRhdGUuIEVycm9yczogJyk7XG4gIH1cbn1cblxuXG5pbnRlcmZhY2UgSm9iSGFuZGxlcldpdGhFeHRyYSBleHRlbmRzIEpvYkhhbmRsZXI8SnNvblZhbHVlLCBKc29uVmFsdWUsIEpzb25WYWx1ZT4ge1xuICBqb2JEZXNjcmlwdGlvbjogSm9iRGVzY3JpcHRpb247XG5cbiAgYXJndW1lbnRWOiBPYnNlcnZhYmxlPHNjaGVtYS5TY2hlbWFWYWxpZGF0b3I+O1xuICBvdXRwdXRWOiBPYnNlcnZhYmxlPHNjaGVtYS5TY2hlbWFWYWxpZGF0b3I+O1xuICBpbnB1dFY6IE9ic2VydmFibGU8c2NoZW1hLlNjaGVtYVZhbGlkYXRvcj47XG59XG5cblxuZnVuY3Rpb24gX2pvYlNoYXJlPFQ+KCk6IE1vbm9UeXBlT3BlcmF0b3JGdW5jdGlvbjxUPiB7XG4gIC8vIFRoaXMgaXMgdGhlIHNhbWUgY29kZSBhcyBhIGBzaGFyZVJlcGxheSgpYCBvcGVyYXRvciwgYnV0IHVzZXMgYSBkdW1iZXIgU3ViamVjdCByYXRoZXIgdGhhbiBhXG4gIC8vIFJlcGxheVN1YmplY3QuXG4gIHJldHVybiAoc291cmNlOiBPYnNlcnZhYmxlPFQ+KTogT2JzZXJ2YWJsZTxUPiA9PiB7XG4gICAgbGV0IHJlZkNvdW50ID0gMDtcbiAgICBsZXQgc3ViamVjdDogU3ViamVjdDxUPjtcbiAgICBsZXQgaGFzRXJyb3IgPSBmYWxzZTtcbiAgICBsZXQgaXNDb21wbGV0ZSA9IGZhbHNlO1xuICAgIGxldCBzdWJzY3JpcHRpb246IFN1YnNjcmlwdGlvbjtcblxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZTxUPihzdWJzY3JpYmVyID0+IHtcbiAgICAgIGxldCBpbm5lclN1YjogU3Vic2NyaXB0aW9uO1xuICAgICAgcmVmQ291bnQrKztcbiAgICAgIGlmICghc3ViamVjdCkge1xuICAgICAgICBzdWJqZWN0ID0gbmV3IFN1YmplY3Q8VD4oKTtcblxuICAgICAgICBpbm5lclN1YiA9IHN1YmplY3Quc3Vic2NyaWJlKHN1YnNjcmliZXIpO1xuICAgICAgICBzdWJzY3JpcHRpb24gPSBzb3VyY2Uuc3Vic2NyaWJlKHtcbiAgICAgICAgICBuZXh0KHZhbHVlKSB7IHN1YmplY3QubmV4dCh2YWx1ZSk7IH0sXG4gICAgICAgICAgZXJyb3IoZXJyKSB7XG4gICAgICAgICAgICBoYXNFcnJvciA9IHRydWU7XG4gICAgICAgICAgICBzdWJqZWN0LmVycm9yKGVycik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21wbGV0ZSgpIHtcbiAgICAgICAgICAgIGlzQ29tcGxldGUgPSB0cnVlO1xuICAgICAgICAgICAgc3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5uZXJTdWIgPSBzdWJqZWN0LnN1YnNjcmliZShzdWJzY3JpYmVyKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgcmVmQ291bnQtLTtcbiAgICAgICAgaW5uZXJTdWIudW5zdWJzY3JpYmUoKTtcbiAgICAgICAgaWYgKHN1YnNjcmlwdGlvbiAmJiByZWZDb3VudCA9PT0gMCAmJiAoaXNDb21wbGV0ZSB8fCBoYXNFcnJvcikpIHtcbiAgICAgICAgICBzdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfTtcbn1cblxuXG4vKipcbiAqIFNpbXBsZSBzY2hlZHVsZXIuIFNob3VsZCBiZSB0aGUgYmFzZSBvZiBhbGwgcmVnaXN0cmllcyBhbmQgc2NoZWR1bGVycy5cbiAqL1xuZXhwb3J0IGNsYXNzIFNpbXBsZVNjaGVkdWxlcjxcbiAgTWluaW11bUFyZ3VtZW50VCBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgTWluaW11bUlucHV0VCBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbiAgTWluaW11bU91dHB1dFQgZXh0ZW5kcyBKc29uVmFsdWUgPSBKc29uVmFsdWUsXG4+IGltcGxlbWVudHMgU2NoZWR1bGVyPE1pbmltdW1Bcmd1bWVudFQsIE1pbmltdW1JbnB1dFQsIE1pbmltdW1PdXRwdXRUPiB7XG4gIHByaXZhdGUgX2ludGVybmFsSm9iRGVzY3JpcHRpb25NYXAgPSBuZXcgTWFwPEpvYk5hbWUsIEpvYkhhbmRsZXJXaXRoRXh0cmE+KCk7XG4gIHByaXZhdGUgX3F1ZXVlOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICBwcml2YXRlIF9wYXVzZUNvdW50ZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBfam9iUmVnaXN0cnk6IFJlZ2lzdHJ5PE1pbmltdW1Bcmd1bWVudFQsIE1pbmltdW1JbnB1dFQsIE1pbmltdW1PdXRwdXRUPixcbiAgICBwcm90ZWN0ZWQgX3NjaGVtYVJlZ2lzdHJ5OiBzY2hlbWEuU2NoZW1hUmVnaXN0cnkgPSBuZXcgc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeSgpLFxuICApIHt9XG5cbiAgcHJpdmF0ZSBfZ2V0SW50ZXJuYWxEZXNjcmlwdGlvbihuYW1lOiBKb2JOYW1lKTogT2JzZXJ2YWJsZTxKb2JIYW5kbGVyV2l0aEV4dHJhIHwgbnVsbD4ge1xuICAgIGNvbnN0IG1heWJlSGFuZGxlciA9IHRoaXMuX2ludGVybmFsSm9iRGVzY3JpcHRpb25NYXAuZ2V0KG5hbWUpO1xuICAgIGlmIChtYXliZUhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG9mKG1heWJlSGFuZGxlcik7XG4gICAgfVxuXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMuX2pvYlJlZ2lzdHJ5LmdldDxNaW5pbXVtQXJndW1lbnRULCBNaW5pbXVtSW5wdXRULCBNaW5pbXVtT3V0cHV0VD4obmFtZSk7XG5cbiAgICByZXR1cm4gaGFuZGxlci5waXBlKFxuICAgICAgc3dpdGNoTWFwKGhhbmRsZXIgPT4ge1xuICAgICAgICBpZiAoaGFuZGxlciA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBvZihudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlc2NyaXB0aW9uOiBKb2JEZXNjcmlwdGlvbiA9IHtcbiAgICAgICAgICAvLyBNYWtlIGEgY29weSBvZiBpdCB0byBiZSBzdXJlIGl0J3MgcHJvcGVyIEpTT04uXG4gICAgICAgICAgLi4uSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShoYW5kbGVyLmpvYkRlc2NyaXB0aW9uKSksXG4gICAgICAgICAgbmFtZTogaGFuZGxlci5qb2JEZXNjcmlwdGlvbi5uYW1lIHx8IG5hbWUsXG4gICAgICAgICAgYXJndW1lbnQ6IGhhbmRsZXIuam9iRGVzY3JpcHRpb24uYXJndW1lbnQgfHwgdHJ1ZSxcbiAgICAgICAgICBpbnB1dDogaGFuZGxlci5qb2JEZXNjcmlwdGlvbi5pbnB1dCB8fCB0cnVlLFxuICAgICAgICAgIG91dHB1dDogaGFuZGxlci5qb2JEZXNjcmlwdGlvbi5vdXRwdXQgfHwgdHJ1ZSxcbiAgICAgICAgICBjaGFubmVsczogaGFuZGxlci5qb2JEZXNjcmlwdGlvbi5jaGFubmVscyB8fCB7fSxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBoYW5kbGVyV2l0aEV4dHJhID0gT2JqZWN0LmFzc2lnbihoYW5kbGVyLmJpbmQodW5kZWZpbmVkKSwge1xuICAgICAgICAgIGpvYkRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbixcbiAgICAgICAgICBhcmd1bWVudFY6IHRoaXMuX3NjaGVtYVJlZ2lzdHJ5LmNvbXBpbGUoZGVzY3JpcHRpb24uYXJndW1lbnQpLnBpcGUoc2hhcmVSZXBsYXkoMSkpLFxuICAgICAgICAgIGlucHV0VjogdGhpcy5fc2NoZW1hUmVnaXN0cnkuY29tcGlsZShkZXNjcmlwdGlvbi5pbnB1dCkucGlwZShzaGFyZVJlcGxheSgxKSksXG4gICAgICAgICAgb3V0cHV0VjogdGhpcy5fc2NoZW1hUmVnaXN0cnkuY29tcGlsZShkZXNjcmlwdGlvbi5vdXRwdXQpLnBpcGUoc2hhcmVSZXBsYXkoMSkpLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5faW50ZXJuYWxKb2JEZXNjcmlwdGlvbk1hcC5zZXQobmFtZSwgaGFuZGxlcldpdGhFeHRyYSk7XG5cbiAgICAgICAgcmV0dXJuIG9mKGhhbmRsZXJXaXRoRXh0cmEpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBqb2IgZGVzY3JpcHRpb24gZm9yIGEgbmFtZWQgam9iLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgam9iLlxuICAgKiBAcmV0dXJucyBBIGRlc2NyaXB0aW9uLCBvciBudWxsIGlmIHRoZSBqb2IgaXMgbm90IHJlZ2lzdGVyZWQuXG4gICAqL1xuICBnZXREZXNjcmlwdGlvbihuYW1lOiBKb2JOYW1lKSB7XG4gICAgcmV0dXJuIGNvbmNhdChcbiAgICAgIHRoaXMuX2dldEludGVybmFsRGVzY3JpcHRpb24obmFtZSkucGlwZShtYXAoeCA9PiB4ICYmIHguam9iRGVzY3JpcHRpb24pKSxcbiAgICAgIG9mKG51bGwpLFxuICAgICkucGlwZShcbiAgICAgIGZpcnN0KCksXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGpvYiBuYW1lIGhhcyBiZWVuIHJlZ2lzdGVyZWQuXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBqb2IuXG4gICAqIEByZXR1cm5zIFRydWUgaWYgdGhlIGpvYiBleGlzdHMsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIGhhcyhuYW1lOiBKb2JOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RGVzY3JpcHRpb24obmFtZSkucGlwZShcbiAgICAgIG1hcCh4ID0+IHggIT09IG51bGwpLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUGF1c2UgdGhlIHNjaGVkdWxlciwgdGVtcG9yYXJ5IHF1ZXVlaW5nIF9uZXdfIGpvYnMuIFJldHVybnMgYSByZXN1bWUgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmVcbiAgICogdXNlZCB0byByZXN1bWUgZXhlY3V0aW9uLiBJZiBtdWx0aXBsZSBgcGF1c2UoKWAgd2VyZSBjYWxsZWQsIGFsbCB0aGVpciByZXN1bWUgZnVuY3Rpb25zIG11c3RcbiAgICogYmUgY2FsbGVkIGJlZm9yZSB0aGUgU2NoZWR1bGVyIGFjdHVhbGx5IHN0YXJ0cyBuZXcgam9icy4gQWRkaXRpb25hbCBjYWxscyB0byB0aGUgc2FtZSByZXN1bWVcbiAgICogZnVuY3Rpb24gd2lsbCBoYXZlIG5vIGVmZmVjdC5cbiAgICpcbiAgICogSm9icyBhbHJlYWR5IHJ1bm5pbmcgYXJlIE5PVCBwYXVzZWQuIFRoaXMgaXMgcGF1c2luZyB0aGUgc2NoZWR1bGVyIG9ubHkuXG4gICAqL1xuICBwYXVzZSgpIHtcbiAgICBsZXQgY2FsbGVkID0gZmFsc2U7XG4gICAgdGhpcy5fcGF1c2VDb3VudGVyKys7XG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKC0tdGhpcy5fcGF1c2VDb3VudGVyID09IDApIHtcbiAgICAgICAgICAvLyBSZXN1bWUgdGhlIHF1ZXVlLlxuICAgICAgICAgIGNvbnN0IHEgPSB0aGlzLl9xdWV1ZTtcbiAgICAgICAgICB0aGlzLl9xdWV1ZSA9IFtdO1xuICAgICAgICAgIHEuZm9yRWFjaChmbiA9PiBmbigpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogU2NoZWR1bGUgYSBqb2IgdG8gYmUgcnVuLCB1c2luZyBpdHMgbmFtZS5cbiAgICogQHBhcmFtIG5hbWUgVGhlIG5hbWUgb2Ygam9iIHRvIGJlIHJ1bi5cbiAgICogQHBhcmFtIGFyZ3VtZW50IFRoZSBhcmd1bWVudCB0byBzZW5kIHRvIHRoZSBqb2Igd2hlbiBzdGFydGluZyBpdC5cbiAgICogQHBhcmFtIG9wdGlvbnMgU2NoZWR1bGluZyBvcHRpb25zLlxuICAgKiBAcmV0dXJucyBUaGUgSm9iIGJlaW5nIHJ1bi5cbiAgICovXG4gIHNjaGVkdWxlPEEgZXh0ZW5kcyBNaW5pbXVtQXJndW1lbnRULCBJIGV4dGVuZHMgTWluaW11bUlucHV0VCwgTyBleHRlbmRzIE1pbmltdW1PdXRwdXRUPihcbiAgICBuYW1lOiBKb2JOYW1lLFxuICAgIGFyZ3VtZW50OiBBLFxuICAgIG9wdGlvbnM/OiBTY2hlZHVsZUpvYk9wdGlvbnMsXG4gICk6IEpvYjxBLCBJLCBPPiB7XG4gICAgaWYgKHRoaXMuX3BhdXNlQ291bnRlciA+IDApIHtcbiAgICAgIGNvbnN0IHdhaXRhYmxlID0gbmV3IFN1YmplY3Q8bmV2ZXI+KCk7XG4gICAgICB0aGlzLl9xdWV1ZS5wdXNoKCgpID0+IHdhaXRhYmxlLmNvbXBsZXRlKCkpO1xuXG4gICAgICByZXR1cm4gdGhpcy5fc2NoZWR1bGVKb2I8QSwgSSwgTz4obmFtZSwgYXJndW1lbnQsIG9wdGlvbnMgfHwge30sIHdhaXRhYmxlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fc2NoZWR1bGVKb2I8QSwgSSwgTz4obmFtZSwgYXJndW1lbnQsIG9wdGlvbnMgfHwge30sIEVNUFRZKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaWx0ZXIgbWVzc2FnZXMuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIF9maWx0ZXJKb2JPdXRib3VuZE1lc3NhZ2VzPE8gZXh0ZW5kcyBNaW5pbXVtT3V0cHV0VD4oXG4gICAgbWVzc2FnZTogSm9iT3V0Ym91bmRNZXNzYWdlPE8+LFxuICAgIHN0YXRlOiBKb2JTdGF0ZSxcbiAgKSB7XG4gICAgc3dpdGNoIChtZXNzYWdlLmtpbmQpIHtcbiAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5PblJlYWR5OlxuICAgICAgICByZXR1cm4gc3RhdGUgPT0gSm9iU3RhdGUuUXVldWVkO1xuICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlN0YXJ0OlxuICAgICAgICByZXR1cm4gc3RhdGUgPT0gSm9iU3RhdGUuUmVhZHk7XG5cbiAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5FbmQ6XG4gICAgICAgIHJldHVybiBzdGF0ZSA9PSBKb2JTdGF0ZS5TdGFydGVkIHx8IHN0YXRlID09IEpvYlN0YXRlLlJlYWR5O1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIG5ldyBzdGF0ZS4gVGhpcyBpcyBqdXN0IHRvIHNpbXBsaWZ5IHRoZSByZWFkaW5nIG9mIHRoZSBfY3JlYXRlSm9iIG1ldGhvZC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZVN0YXRlPE8gZXh0ZW5kcyBNaW5pbXVtT3V0cHV0VD4oXG4gICAgbWVzc2FnZTogSm9iT3V0Ym91bmRNZXNzYWdlPE8+LFxuICAgIHN0YXRlOiBKb2JTdGF0ZSxcbiAgKTogSm9iU3RhdGUge1xuICAgIHN3aXRjaCAobWVzc2FnZS5raW5kKSB7XG4gICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuT25SZWFkeTpcbiAgICAgICAgcmV0dXJuIEpvYlN0YXRlLlJlYWR5O1xuICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlN0YXJ0OlxuICAgICAgICByZXR1cm4gSm9iU3RhdGUuU3RhcnRlZDtcbiAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5FbmQ6XG4gICAgICAgIHJldHVybiBKb2JTdGF0ZS5FbmRlZDtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdGU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIHRoZSBqb2IuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGVKb2I8QSBleHRlbmRzIE1pbmltdW1Bcmd1bWVudFQsIEkgZXh0ZW5kcyBNaW5pbXVtSW5wdXRULCBPIGV4dGVuZHMgTWluaW11bU91dHB1dFQ+KFxuICAgIG5hbWU6IEpvYk5hbWUsXG4gICAgYXJndW1lbnQ6IEEsXG4gICAgaGFuZGxlcjogT2JzZXJ2YWJsZTxKb2JIYW5kbGVyV2l0aEV4dHJhIHwgbnVsbD4sXG4gICAgaW5ib3VuZEJ1czogT2JzZXJ2ZXI8Sm9iSW5ib3VuZE1lc3NhZ2U8ST4+LFxuICAgIG91dGJvdW5kQnVzOiBPYnNlcnZhYmxlPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4sXG4gICAgb3B0aW9uczogU2NoZWR1bGVKb2JPcHRpb25zLFxuICApOiBKb2I8QSwgSSwgTz4ge1xuICAgIGNvbnN0IHNjaGVtYVJlZ2lzdHJ5ID0gdGhpcy5fc2NoZW1hUmVnaXN0cnk7XG5cbiAgICBjb25zdCBjaGFubmVsc1N1YmplY3QgPSBuZXcgTWFwPHN0cmluZywgU3ViamVjdDxKc29uVmFsdWU+PigpO1xuICAgIGNvbnN0IGNoYW5uZWxzID0gbmV3IE1hcDxzdHJpbmcsIE9ic2VydmFibGU8SnNvblZhbHVlPj4oKTtcblxuICAgIGxldCBzdGF0ZSA9IEpvYlN0YXRlLlF1ZXVlZDtcbiAgICBsZXQgcGluZ0lkID0gMDtcblxuICAgIGNvbnN0IGxvZ2dlciA9IG9wdGlvbnMubG9nZ2VyID8gb3B0aW9ucy5sb2dnZXIuY3JlYXRlQ2hpbGQoJ2pvYicpIDogbmV3IE51bGxMb2dnZXIoKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgaW5wdXQgY2hhbm5lbCBieSBoYXZpbmcgYSBmaWx0ZXIuXG4gICAgY29uc3QgaW5wdXQgPSBuZXcgU3ViamVjdDxKc29uVmFsdWU+KCk7XG4gICAgaW5wdXQucGlwZShcbiAgICAgIHN3aXRjaE1hcChtZXNzYWdlID0+IGhhbmRsZXIucGlwZShcbiAgICAgICAgc3dpdGNoTWFwKGhhbmRsZXIgPT4ge1xuICAgICAgICAgIGlmIChoYW5kbGVyID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSm9iRG9lc05vdEV4aXN0RXhjZXB0aW9uKG5hbWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaGFuZGxlci5pbnB1dFYucGlwZShcbiAgICAgICAgICAgICAgc3dpdGNoTWFwKHZhbGlkYXRlID0+IHZhbGlkYXRlKG1lc3NhZ2UpKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICkpLFxuICAgICAgZmlsdGVyKHJlc3VsdCA9PiByZXN1bHQuc3VjY2VzcyksXG4gICAgICBtYXAocmVzdWx0ID0+IHJlc3VsdC5kYXRhIGFzIEkpLFxuICAgICkuc3Vic2NyaWJlKFxuICAgICAgdmFsdWUgPT4gaW5ib3VuZEJ1cy5uZXh0KHsga2luZDogSm9iSW5ib3VuZE1lc3NhZ2VLaW5kLklucHV0LCB2YWx1ZSB9KSxcbiAgICApO1xuXG4gICAgb3V0Ym91bmRCdXMgPSBjb25jYXQoXG4gICAgICBvdXRib3VuZEJ1cyxcbiAgICAgIC8vIEFkZCBhbiBFbmQgbWVzc2FnZSBhdCBjb21wbGV0aW9uLiBUaGlzIHdpbGwgYmUgZmlsdGVyZWQgb3V0IGlmIHRoZSBqb2IgYWN0dWFsbHkgc2VuZCBhblxuICAgICAgLy8gRW5kLlxuICAgICAgaGFuZGxlci5waXBlKHN3aXRjaE1hcChoYW5kbGVyID0+IHtcbiAgICAgICAgaWYgKGhhbmRsZXIpIHtcbiAgICAgICAgICByZXR1cm4gb2Y8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+Pih7XG4gICAgICAgICAgICBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkVuZCwgZGVzY3JpcHRpb246IGhhbmRsZXIuam9iRGVzY3JpcHRpb24sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIEVNUFRZIGFzIE9ic2VydmFibGU8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+PjtcbiAgICAgICAgfVxuICAgICAgfSkpLFxuICAgICkucGlwZShcbiAgICAgIGZpbHRlcihtZXNzYWdlID0+IHRoaXMuX2ZpbHRlckpvYk91dGJvdW5kTWVzc2FnZXMobWVzc2FnZSwgc3RhdGUpKSxcbiAgICAgIC8vIFVwZGF0ZSBpbnRlcm5hbCBsb2dpYyBhbmQgSm9iPD4gbWVtYmVycy5cbiAgICAgIHRhcChtZXNzYWdlID0+IHtcbiAgICAgICAgLy8gVXBkYXRlIHRoZSBzdGF0ZS5cbiAgICAgICAgc3RhdGUgPSB0aGlzLl91cGRhdGVTdGF0ZShtZXNzYWdlLCBzdGF0ZSk7XG5cbiAgICAgICAgc3dpdGNoIChtZXNzYWdlLmtpbmQpIHtcbiAgICAgICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuTG9nOlxuICAgICAgICAgICAgbG9nZ2VyLm5leHQobWVzc2FnZS5lbnRyeSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5DaGFubmVsQ3JlYXRlOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICAvLyBJZiBpdCBkb2Vzbid0IGV4aXN0IG9yIGl0J3MgY2xvc2VkIG9uIHRoZSBvdGhlciBlbmQuXG4gICAgICAgICAgICBpZiAoIW1heWJlU3ViamVjdCkge1xuICAgICAgICAgICAgICBjb25zdCBzID0gbmV3IFN1YmplY3Q8SnNvblZhbHVlPigpO1xuICAgICAgICAgICAgICBjaGFubmVsc1N1YmplY3Quc2V0KG1lc3NhZ2UubmFtZSwgcyk7XG4gICAgICAgICAgICAgIGNoYW5uZWxzLnNldChtZXNzYWdlLm5hbWUsIHMuYXNPYnNlcnZhYmxlKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkNoYW5uZWxNZXNzYWdlOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICBpZiAobWF5YmVTdWJqZWN0KSB7XG4gICAgICAgICAgICAgIG1heWJlU3ViamVjdC5uZXh0KG1lc3NhZ2UubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbENvbXBsZXRlOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICBpZiAobWF5YmVTdWJqZWN0KSB7XG4gICAgICAgICAgICAgIG1heWJlU3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICBjaGFubmVsc1N1YmplY3QuZGVsZXRlKG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbEVycm9yOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICBpZiAobWF5YmVTdWJqZWN0KSB7XG4gICAgICAgICAgICAgIG1heWJlU3ViamVjdC5lcnJvcihtZXNzYWdlLmVycm9yKTtcbiAgICAgICAgICAgICAgY2hhbm5lbHNTdWJqZWN0LmRlbGV0ZShtZXNzYWdlLm5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCAoKSA9PiB7XG4gICAgICAgIHN0YXRlID0gSm9iU3RhdGUuRXJyb3JlZDtcbiAgICAgIH0pLFxuXG4gICAgICAvLyBEbyBvdXRwdXQgdmFsaWRhdGlvbiAobWlnaHQgaW5jbHVkZSBkZWZhdWx0IHZhbHVlcyBzbyB0aGlzIG1pZ2h0IGhhdmUgc2lkZVxuICAgICAgLy8gZWZmZWN0cykuIFdlIGtlZXAgYWxsIG1lc3NhZ2VzIGluIG9yZGVyLlxuICAgICAgY29uY2F0TWFwKG1lc3NhZ2UgPT4ge1xuICAgICAgICBpZiAobWVzc2FnZS5raW5kICE9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk91dHB1dCkge1xuICAgICAgICAgIHJldHVybiBvZihtZXNzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBoYW5kbGVyLnBpcGUoXG4gICAgICAgICAgc3dpdGNoTWFwKGhhbmRsZXIgPT4ge1xuICAgICAgICAgICAgaWYgKGhhbmRsZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEpvYkRvZXNOb3RFeGlzdEV4Y2VwdGlvbihuYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLm91dHB1dFYucGlwZShcbiAgICAgICAgICAgICAgICBzd2l0Y2hNYXAodmFsaWRhdGUgPT4gdmFsaWRhdGUobWVzc2FnZS52YWx1ZSkpLFxuICAgICAgICAgICAgICAgIHN3aXRjaE1hcChvdXRwdXQgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKCFvdXRwdXQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSm9iT3V0cHV0U2NoZW1hVmFsaWRhdGlvbkVycm9yKG91dHB1dC5lcnJvcnMpO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICByZXR1cm4gb2Yoe1xuICAgICAgICAgICAgICAgICAgICAuLi5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQ6IG91dHB1dC5kYXRhIGFzIE8sXG4gICAgICAgICAgICAgICAgICB9IGFzIEpvYk91dGJvdW5kTWVzc2FnZU91dHB1dDxPPik7XG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICkgYXMgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+O1xuICAgICAgfSksXG4gICAgICBfam9iU2hhcmUoKSxcbiAgICApO1xuXG4gICAgY29uc3Qgb3V0cHV0ID0gb3V0Ym91bmRCdXMucGlwZShcbiAgICAgIGZpbHRlcih4ID0+IHgua2luZCA9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk91dHB1dCksXG4gICAgICBtYXAoKHg6IEpvYk91dGJvdW5kTWVzc2FnZU91dHB1dDxPPikgPT4geC52YWx1ZSksXG4gICAgICBzaGFyZVJlcGxheSgxKSxcbiAgICApO1xuXG4gICAgLy8gUmV0dXJuIHRoZSBKb2IuXG4gICAgcmV0dXJuIHtcbiAgICAgIGdldCBzdGF0ZSgpIHsgcmV0dXJuIHN0YXRlOyB9LFxuICAgICAgYXJndW1lbnQsXG4gICAgICBkZXNjcmlwdGlvbjogaGFuZGxlci5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoaGFuZGxlciA9PiB7XG4gICAgICAgICAgaWYgKGhhbmRsZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBKb2JEb2VzTm90RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBvZihoYW5kbGVyLmpvYkRlc2NyaXB0aW9uKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICAgIG91dHB1dCxcbiAgICAgIGdldENoYW5uZWw8VCBleHRlbmRzIEpzb25WYWx1ZT4oXG4gICAgICAgIG5hbWU6IEpvYk5hbWUsXG4gICAgICAgIHNjaGVtYTogc2NoZW1hLkpzb25TY2hlbWEgPSB0cnVlLFxuICAgICAgKTogT2JzZXJ2YWJsZTxUPiB7XG4gICAgICAgIGxldCBtYXliZU9ic2VydmFibGUgPSBjaGFubmVscy5nZXQobmFtZSk7XG4gICAgICAgIGlmICghbWF5YmVPYnNlcnZhYmxlKSB7XG4gICAgICAgICAgY29uc3QgcyA9IG5ldyBTdWJqZWN0PFQ+KCk7XG4gICAgICAgICAgY2hhbm5lbHNTdWJqZWN0LnNldChuYW1lLCBzKTtcbiAgICAgICAgICBjaGFubmVscy5zZXQobmFtZSwgcy5hc09ic2VydmFibGUoKSk7XG5cbiAgICAgICAgICBtYXliZU9ic2VydmFibGUgPSBzLmFzT2JzZXJ2YWJsZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1heWJlT2JzZXJ2YWJsZS5waXBlKFxuICAgICAgICAgIC8vIEtlZXAgdGhlIG9yZGVyIG9mIG1lc3NhZ2VzLlxuICAgICAgICAgIGNvbmNhdE1hcChcbiAgICAgICAgICAgIG1lc3NhZ2UgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gc2NoZW1hUmVnaXN0cnkuY29tcGlsZShzY2hlbWEpLnBpcGUoXG4gICAgICAgICAgICAgICAgc3dpdGNoTWFwKHZhbGlkYXRlID0+IHZhbGlkYXRlKG1lc3NhZ2UpKSxcbiAgICAgICAgICAgICAgICBmaWx0ZXIoeCA9PiB4LnN1Y2Nlc3MpLFxuICAgICAgICAgICAgICAgIG1hcCh4ID0+IHguZGF0YSBhcyBUKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBwaW5nKCkge1xuICAgICAgICBjb25zdCBpZCA9IHBpbmdJZCsrO1xuICAgICAgICBpbmJvdW5kQnVzLm5leHQoeyBraW5kOiBKb2JJbmJvdW5kTWVzc2FnZUtpbmQuUGluZywgaWQgfSk7XG5cbiAgICAgICAgcmV0dXJuIG91dGJvdW5kQnVzLnBpcGUoXG4gICAgICAgICAgZmlsdGVyKHggPT4geC5raW5kID09PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlBvbmcgJiYgeC5pZCA9PSBpZCksXG4gICAgICAgICAgZmlyc3QoKSxcbiAgICAgICAgICBpZ25vcmVFbGVtZW50cygpLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIHN0b3AoKSB7XG4gICAgICAgIGluYm91bmRCdXMubmV4dCh7IGtpbmQ6IEpvYkluYm91bmRNZXNzYWdlS2luZC5TdG9wIH0pO1xuICAgICAgfSxcbiAgICAgIGlucHV0LFxuICAgICAgaW5ib3VuZEJ1cyxcbiAgICAgIG91dGJvdW5kQnVzLFxuICAgIH07XG4gIH1cblxuICBwcm90ZWN0ZWQgX3NjaGVkdWxlSm9iPFxuICAgIEEgZXh0ZW5kcyBNaW5pbXVtQXJndW1lbnRULFxuICAgIEkgZXh0ZW5kcyBNaW5pbXVtSW5wdXRULFxuICAgIE8gZXh0ZW5kcyBNaW5pbXVtT3V0cHV0VCxcbiAgPihcbiAgICBuYW1lOiBKb2JOYW1lLFxuICAgIGFyZ3VtZW50OiBBLFxuICAgIG9wdGlvbnM6IFNjaGVkdWxlSm9iT3B0aW9ucyxcbiAgICB3YWl0YWJsZTogT2JzZXJ2YWJsZTxuZXZlcj4sXG4gICk6IEpvYjxBLCBJLCBPPiB7XG4gICAgLy8gR2V0IGhhbmRsZXIgZmlyc3QsIHNpbmNlIHRoaXMgY2FuIGVycm9yIG91dCBpZiB0aGVyZSdzIG5vIGhhbmRsZXIgZm9yIHRoZSBqb2IgbmFtZS5cbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fZ2V0SW50ZXJuYWxEZXNjcmlwdGlvbihuYW1lKTtcblxuICAgIGNvbnN0IG9wdGlvbnNEZXBzID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXBlbmRlbmNpZXMpIHx8IFtdO1xuICAgIGNvbnN0IGRlcGVuZGVuY2llcyA9IEFycmF5LmlzQXJyYXkob3B0aW9uc0RlcHMpID8gb3B0aW9uc0RlcHMgOiBbb3B0aW9uc0RlcHNdO1xuXG4gICAgY29uc3QgaW5ib3VuZEJ1cyA9IG5ldyBTdWJqZWN0PEpvYkluYm91bmRNZXNzYWdlPEk+PigpO1xuICAgIGNvbnN0IG91dGJvdW5kQnVzID0gY29uY2F0KFxuICAgICAgLy8gV2FpdCBmb3IgZGVwZW5kZW5jaWVzLCBtYWtlIHN1cmUgdG8gbm90IHJlcG9ydCBtZXNzYWdlcyBmcm9tIGRlcGVuZGVuY2llcy4gU3Vic2NyaWJlIHRvXG4gICAgICAvLyBhbGwgZGVwZW5kZW5jaWVzIGF0IHRoZSBzYW1lIHRpbWUgc28gdGhleSBydW4gY29uY3VycmVudGx5LlxuICAgICAgbWVyZ2UoLi4uZGVwZW5kZW5jaWVzLm1hcCh4ID0+IHgub3V0Ym91bmRCdXMpKS5waXBlKGlnbm9yZUVsZW1lbnRzKCkpLFxuXG4gICAgICAvLyBXYWl0IGZvciBwYXVzZSgpIHRvIGNsZWFyIChpZiBuZWNlc3NhcnkpLlxuICAgICAgd2FpdGFibGUsXG5cbiAgICAgIGZyb20oaGFuZGxlcikucGlwZShcbiAgICAgICAgc3dpdGNoTWFwKGhhbmRsZXIgPT4gbmV3IE9ic2VydmFibGUoKHN1YnNjcmliZXI6IE9ic2VydmVyPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4pID0+IHtcbiAgICAgICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBKb2JEb2VzTm90RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVmFsaWRhdGUgdGhlIGFyZ3VtZW50LlxuICAgICAgICAgIHJldHVybiBoYW5kbGVyLmFyZ3VtZW50Vi5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKHZhbGlkYXRlID0+IHZhbGlkYXRlKGFyZ3VtZW50KSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAob3V0cHV0ID0+IHtcbiAgICAgICAgICAgICAgaWYgKCFvdXRwdXQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBKb2JBcmd1bWVudFNjaGVtYVZhbGlkYXRpb25FcnJvcihvdXRwdXQuZXJyb3JzKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGFyZ3VtZW50OiBBID0gb3V0cHV0LmRhdGEgYXMgQTtcbiAgICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRpb24gPSBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk9uUmVhZHksIGRlc2NyaXB0aW9uIH0pO1xuXG4gICAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzOiBbLi4uZGVwZW5kZW5jaWVzXSxcbiAgICAgICAgICAgICAgICBpbmJvdW5kQnVzOiBpbmJvdW5kQnVzLmFzT2JzZXJ2YWJsZSgpLFxuICAgICAgICAgICAgICAgIHNjaGVkdWxlcjogdGhpcyBhcyBTY2hlZHVsZXI8TWluaW11bUFyZ3VtZW50VCwgTWluaW11bUlucHV0VCwgTWluaW11bU91dHB1dFQ+LFxuICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyKGFyZ3VtZW50LCBjb250ZXh0KTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICkuc3Vic2NyaWJlKHN1YnNjcmliZXIpO1xuICAgICAgICB9KSksXG4gICAgICApLFxuICAgICk7XG5cbiAgICByZXR1cm4gdGhpcy5fY3JlYXRlSm9iKG5hbWUsIGFyZ3VtZW50LCBoYW5kbGVyLCBpbmJvdW5kQnVzLCBvdXRib3VuZEJ1cywgb3B0aW9ucyk7XG4gIH1cbn1cbiJdfQ==