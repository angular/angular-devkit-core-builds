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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2ltcGxlLXNjaGVkdWxlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvZXhwZXJpbWVudGFsL2pvYnMvc2ltcGxlLXNjaGVkdWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtCQVdjO0FBQ2QsOENBU3dCO0FBQ3hCLHFDQUErQztBQUMvQywrQkFjZTtBQUNmLDJDQUF1RDtBQUd2RCxNQUFhLGdDQUFpQyxTQUFRLGFBQU0sQ0FBQyx5QkFBeUI7SUFDcEYsWUFBWSxNQUFzQztRQUNoRCxLQUFLLENBQUMsTUFBTSxFQUFFLDJDQUEyQyxDQUFDLENBQUM7SUFDN0QsQ0FBQztDQUNGO0FBSkQsNEVBSUM7QUFDRCxNQUFhLHNDQUF1QyxTQUFRLGFBQU0sQ0FBQyx5QkFBeUI7SUFDMUYsWUFBWSxNQUFzQztRQUNoRCxLQUFLLENBQUMsTUFBTSxFQUFFLGtEQUFrRCxDQUFDLENBQUM7SUFDcEUsQ0FBQztDQUNGO0FBSkQsd0ZBSUM7QUFDRCxNQUFhLDhCQUErQixTQUFRLGFBQU0sQ0FBQyx5QkFBeUI7SUFDbEYsWUFBWSxNQUFzQztRQUNoRCxLQUFLLENBQUMsTUFBTSxFQUFFLHlDQUF5QyxDQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNGO0FBSkQsd0VBSUM7QUFZRCxTQUFTLFNBQVM7SUFDaEIsK0ZBQStGO0lBQy9GLGlCQUFpQjtJQUNqQixPQUFPLENBQUMsTUFBcUIsRUFBaUIsRUFBRTtRQUM5QyxJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDakIsSUFBSSxPQUFtQixDQUFDO1FBQ3hCLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztRQUNyQixJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7UUFDdkIsSUFBSSxZQUEwQixDQUFDO1FBRS9CLE9BQU8sSUFBSSxpQkFBVSxDQUFJLFVBQVUsQ0FBQyxFQUFFO1lBQ3BDLElBQUksUUFBc0IsQ0FBQztZ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QUFDLFFBQVEsQ0FBQyxDQUFDLEVBQ3pDLHFCQUFTLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO29CQUNuQixNQUFNLElBQUksZ0NBQWdDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUMzRDtnQkFFRCxNQUFNLFFBQVEsR0FBTSxNQUFNLENBQUMsSUFBUyxDQUFDO2dCQUNyQyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDO2dCQUMzQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLDRCQUFzQixDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO2dCQUV2RSxNQUFNLE9BQU8sR0FBRztvQkFDZCxXQUFXO29CQUNYLFlBQVksRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDO29CQUMvQixVQUFVLEVBQUUsVUFBVSxDQUFDLFlBQVksRUFBRTtvQkFDckMsU0FBUyxFQUFFLElBQWtFO2lCQUM5RSxDQUFDO2dCQUVGLE9BQU8sT0FBTyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNwQyxDQUFDLENBQUMsQ0FDSCxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMxQixDQUFDLENBQUMsQ0FBQyxDQUNKLENBQ0YsQ0FBQztRQUVGLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3BGLENBQUM7Q0FDRjtBQXZhRCwwQ0F1YUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge1xuICBFTVBUWSxcbiAgTW9ub1R5cGVPcGVyYXRvckZ1bmN0aW9uLFxuICBPYnNlcnZhYmxlLFxuICBPYnNlcnZlcixcbiAgU3ViamVjdCxcbiAgU3Vic2NyaXB0aW9uLFxuICBjb25jYXQsXG4gIGZyb20sXG4gIG1lcmdlLFxuICBvZixcbn0gZnJvbSAncnhqcyc7XG5pbXBvcnQge1xuICBjb25jYXRNYXAsXG4gIGZpbHRlcixcbiAgZmlyc3QsXG4gIGlnbm9yZUVsZW1lbnRzLFxuICBtYXAsXG4gIHNoYXJlUmVwbGF5LFxuICBzd2l0Y2hNYXAsXG4gIHRhcCxcbn0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgSnNvblZhbHVlLCBzY2hlbWEgfSBmcm9tICcuLi8uLi9qc29uJztcbmltcG9ydCB7XG4gIEpvYixcbiAgSm9iRGVzY3JpcHRpb24sXG4gIEpvYkhhbmRsZXIsXG4gIEpvYkluYm91bmRNZXNzYWdlLFxuICBKb2JJbmJvdW5kTWVzc2FnZUtpbmQsXG4gIEpvYk5hbWUsXG4gIEpvYk91dGJvdW5kTWVzc2FnZSxcbiAgSm9iT3V0Ym91bmRNZXNzYWdlS2luZCxcbiAgSm9iT3V0Ym91bmRNZXNzYWdlT3V0cHV0LFxuICBKb2JTdGF0ZSxcbiAgUmVnaXN0cnksXG4gIFNjaGVkdWxlSm9iT3B0aW9ucyxcbiAgU2NoZWR1bGVyLFxufSBmcm9tICcuL2FwaSc7XG5pbXBvcnQgeyBKb2JEb2VzTm90RXhpc3RFeGNlcHRpb24gfSBmcm9tICcuL2V4Y2VwdGlvbic7XG5cblxuZXhwb3J0IGNsYXNzIEpvYkFyZ3VtZW50U2NoZW1hVmFsaWRhdGlvbkVycm9yIGV4dGVuZHMgc2NoZW1hLlNjaGVtYVZhbGlkYXRpb25FeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihlcnJvcnM/OiBzY2hlbWEuU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSkge1xuICAgIHN1cGVyKGVycm9ycywgJ0pvYiBBcmd1bWVudCBmYWlsZWQgdG8gdmFsaWRhdGUuIEVycm9yczogJyk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBKb2JJbmJvdW5kTWVzc2FnZVNjaGVtYVZhbGlkYXRpb25FcnJvciBleHRlbmRzIHNjaGVtYS5TY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoZXJyb3JzPzogc2NoZW1hLlNjaGVtYVZhbGlkYXRvckVycm9yW10pIHtcbiAgICBzdXBlcihlcnJvcnMsICdKb2IgSW5ib3VuZCBNZXNzYWdlIGZhaWxlZCB0byB2YWxpZGF0ZS4gRXJyb3JzOiAnKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEpvYk91dHB1dFNjaGVtYVZhbGlkYXRpb25FcnJvciBleHRlbmRzIHNjaGVtYS5TY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoZXJyb3JzPzogc2NoZW1hLlNjaGVtYVZhbGlkYXRvckVycm9yW10pIHtcbiAgICBzdXBlcihlcnJvcnMsICdKb2IgT3V0cHV0IGZhaWxlZCB0byB2YWxpZGF0ZS4gRXJyb3JzOiAnKTtcbiAgfVxufVxuXG5cbmludGVyZmFjZSBKb2JIYW5kbGVyV2l0aEV4dHJhIGV4dGVuZHMgSm9iSGFuZGxlcjxKc29uVmFsdWUsIEpzb25WYWx1ZSwgSnNvblZhbHVlPiB7XG4gIGpvYkRlc2NyaXB0aW9uOiBKb2JEZXNjcmlwdGlvbjtcblxuICBhcmd1bWVudFY6IE9ic2VydmFibGU8c2NoZW1hLlNjaGVtYVZhbGlkYXRvcj47XG4gIG91dHB1dFY6IE9ic2VydmFibGU8c2NoZW1hLlNjaGVtYVZhbGlkYXRvcj47XG4gIGlucHV0VjogT2JzZXJ2YWJsZTxzY2hlbWEuU2NoZW1hVmFsaWRhdG9yPjtcbn1cblxuXG5mdW5jdGlvbiBfam9iU2hhcmU8VD4oKTogTW9ub1R5cGVPcGVyYXRvckZ1bmN0aW9uPFQ+IHtcbiAgLy8gVGhpcyBpcyB0aGUgc2FtZSBjb2RlIGFzIGEgYHNoYXJlUmVwbGF5KClgIG9wZXJhdG9yLCBidXQgdXNlcyBhIGR1bWJlciBTdWJqZWN0IHJhdGhlciB0aGFuIGFcbiAgLy8gUmVwbGF5U3ViamVjdC5cbiAgcmV0dXJuIChzb3VyY2U6IE9ic2VydmFibGU8VD4pOiBPYnNlcnZhYmxlPFQ+ID0+IHtcbiAgICBsZXQgcmVmQ291bnQgPSAwO1xuICAgIGxldCBzdWJqZWN0OiBTdWJqZWN0PFQ+O1xuICAgIGxldCBoYXNFcnJvciA9IGZhbHNlO1xuICAgIGxldCBpc0NvbXBsZXRlID0gZmFsc2U7XG4gICAgbGV0IHN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xuXG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPFQ+KHN1YnNjcmliZXIgPT4ge1xuICAgICAgbGV0IGlubmVyU3ViOiBTdWJzY3JpcHRpb247XG4gICAgICByZWZDb3VudCsrO1xuICAgICAgaWYgKCFzdWJqZWN0KSB7XG4gICAgICAgIHN1YmplY3QgPSBuZXcgU3ViamVjdDxUPigpO1xuXG4gICAgICAgIGlubmVyU3ViID0gc3ViamVjdC5zdWJzY3JpYmUoc3Vic2NyaWJlcik7XG4gICAgICAgIHN1YnNjcmlwdGlvbiA9IHNvdXJjZS5zdWJzY3JpYmUoe1xuICAgICAgICAgIG5leHQodmFsdWUpIHsgc3ViamVjdC5uZXh0KHZhbHVlKTsgfSxcbiAgICAgICAgICBlcnJvcihlcnIpIHtcbiAgICAgICAgICAgIGhhc0Vycm9yID0gdHJ1ZTtcbiAgICAgICAgICAgIHN1YmplY3QuZXJyb3IoZXJyKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbXBsZXRlKCkge1xuICAgICAgICAgICAgaXNDb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgICBzdWJqZWN0LmNvbXBsZXRlKCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbm5lclN1YiA9IHN1YmplY3Quc3Vic2NyaWJlKHN1YnNjcmliZXIpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICByZWZDb3VudC0tO1xuICAgICAgICBpbm5lclN1Yi51bnN1YnNjcmliZSgpO1xuICAgICAgICBpZiAoc3Vic2NyaXB0aW9uICYmIHJlZkNvdW50ID09PSAwICYmIChpc0NvbXBsZXRlIHx8IGhhc0Vycm9yKSkge1xuICAgICAgICAgIHN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9O1xufVxuXG5cbi8qKlxuICogU2ltcGxlIHNjaGVkdWxlci4gU2hvdWxkIGJlIHRoZSBiYXNlIG9mIGFsbCByZWdpc3RyaWVzIGFuZCBzY2hlZHVsZXJzLlxuICovXG5leHBvcnQgY2xhc3MgU2ltcGxlU2NoZWR1bGVyPFxuICBNaW5pbXVtQXJndW1lbnRUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICBNaW5pbXVtSW5wdXRUIGV4dGVuZHMgSnNvblZhbHVlID0gSnNvblZhbHVlLFxuICBNaW5pbXVtT3V0cHV0VCBleHRlbmRzIEpzb25WYWx1ZSA9IEpzb25WYWx1ZSxcbj4gaW1wbGVtZW50cyBTY2hlZHVsZXI8TWluaW11bUFyZ3VtZW50VCwgTWluaW11bUlucHV0VCwgTWluaW11bU91dHB1dFQ+IHtcbiAgcHJpdmF0ZSBfaW50ZXJuYWxKb2JEZXNjcmlwdGlvbk1hcCA9IG5ldyBNYXA8Sm9iTmFtZSwgSm9iSGFuZGxlcldpdGhFeHRyYT4oKTtcbiAgcHJpdmF0ZSBfcXVldWU6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIHByaXZhdGUgX3BhdXNlQ291bnRlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIF9qb2JSZWdpc3RyeTogUmVnaXN0cnk8TWluaW11bUFyZ3VtZW50VCwgTWluaW11bUlucHV0VCwgTWluaW11bU91dHB1dFQ+LFxuICAgIHByb3RlY3RlZCBfc2NoZW1hUmVnaXN0cnk6IHNjaGVtYS5TY2hlbWFSZWdpc3RyeSA9IG5ldyBzY2hlbWEuQ29yZVNjaGVtYVJlZ2lzdHJ5KCksXG4gICkge31cblxuICBwcml2YXRlIF9nZXRJbnRlcm5hbERlc2NyaXB0aW9uKG5hbWU6IEpvYk5hbWUpOiBPYnNlcnZhYmxlPEpvYkhhbmRsZXJXaXRoRXh0cmEgfCBudWxsPiB7XG4gICAgY29uc3QgbWF5YmVIYW5kbGVyID0gdGhpcy5faW50ZXJuYWxKb2JEZXNjcmlwdGlvbk1hcC5nZXQobmFtZSk7XG4gICAgaWYgKG1heWJlSGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gb2YobWF5YmVIYW5kbGVyKTtcbiAgICB9XG5cbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fam9iUmVnaXN0cnkuZ2V0PE1pbmltdW1Bcmd1bWVudFQsIE1pbmltdW1JbnB1dFQsIE1pbmltdW1PdXRwdXRUPihuYW1lKTtcblxuICAgIHJldHVybiBoYW5kbGVyLnBpcGUoXG4gICAgICBzd2l0Y2hNYXAoaGFuZGxlciA9PiB7XG4gICAgICAgIGlmIChoYW5kbGVyID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG9mKG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVzY3JpcHRpb246IEpvYkRlc2NyaXB0aW9uID0ge1xuICAgICAgICAgIC8vIE1ha2UgYSBjb3B5IG9mIGl0IHRvIGJlIHN1cmUgaXQncyBwcm9wZXIgSlNPTi5cbiAgICAgICAgICAuLi5KU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGhhbmRsZXIuam9iRGVzY3JpcHRpb24pKSxcbiAgICAgICAgICBuYW1lOiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLm5hbWUgfHwgbmFtZSxcbiAgICAgICAgICBhcmd1bWVudDogaGFuZGxlci5qb2JEZXNjcmlwdGlvbi5hcmd1bWVudCB8fCB0cnVlLFxuICAgICAgICAgIGlucHV0OiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLmlucHV0IHx8IHRydWUsXG4gICAgICAgICAgb3V0cHV0OiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLm91dHB1dCB8fCB0cnVlLFxuICAgICAgICAgIGNoYW5uZWxzOiBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uLmNoYW5uZWxzIHx8IHt9LFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGhhbmRsZXJXaXRoRXh0cmEgPSBPYmplY3QuYXNzaWduKGhhbmRsZXIuYmluZCh1bmRlZmluZWQpLCB7XG4gICAgICAgICAgam9iRGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuICAgICAgICAgIGFyZ3VtZW50VjogdGhpcy5fc2NoZW1hUmVnaXN0cnkuY29tcGlsZShkZXNjcmlwdGlvbi5hcmd1bWVudCkucGlwZShzaGFyZVJlcGxheSgxKSksXG4gICAgICAgICAgaW5wdXRWOiB0aGlzLl9zY2hlbWFSZWdpc3RyeS5jb21waWxlKGRlc2NyaXB0aW9uLmlucHV0KS5waXBlKHNoYXJlUmVwbGF5KDEpKSxcbiAgICAgICAgICBvdXRwdXRWOiB0aGlzLl9zY2hlbWFSZWdpc3RyeS5jb21waWxlKGRlc2NyaXB0aW9uLm91dHB1dCkucGlwZShzaGFyZVJlcGxheSgxKSksXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbnRlcm5hbEpvYkRlc2NyaXB0aW9uTWFwLnNldChuYW1lLCBoYW5kbGVyV2l0aEV4dHJhKTtcblxuICAgICAgICByZXR1cm4gb2YoaGFuZGxlcldpdGhFeHRyYSk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIGpvYiBkZXNjcmlwdGlvbiBmb3IgYSBuYW1lZCBqb2IuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBqb2IuXG4gICAqIEByZXR1cm5zIEEgZGVzY3JpcHRpb24sIG9yIG51bGwgaWYgdGhlIGpvYiBpcyBub3QgcmVnaXN0ZXJlZC5cbiAgICovXG4gIGdldERlc2NyaXB0aW9uKG5hbWU6IEpvYk5hbWUpIHtcbiAgICByZXR1cm4gY29uY2F0KFxuICAgICAgdGhpcy5fZ2V0SW50ZXJuYWxEZXNjcmlwdGlvbihuYW1lKS5waXBlKG1hcCh4ID0+IHggJiYgeC5qb2JEZXNjcmlwdGlvbikpLFxuICAgICAgb2YobnVsbCksXG4gICAgKS5waXBlKFxuICAgICAgZmlyc3QoKSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgam9iIG5hbWUgaGFzIGJlZW4gcmVnaXN0ZXJlZC5cbiAgICogQHBhcmFtIG5hbWUgVGhlIG5hbWUgb2YgdGhlIGpvYi5cbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgam9iIGV4aXN0cywgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgKi9cbiAgaGFzKG5hbWU6IEpvYk5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5nZXREZXNjcmlwdGlvbihuYW1lKS5waXBlKFxuICAgICAgbWFwKHggPT4geCAhPT0gbnVsbCksXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXVzZSB0aGUgc2NoZWR1bGVyLCB0ZW1wb3JhcnkgcXVldWVpbmcgX25ld18gam9icy4gUmV0dXJucyBhIHJlc3VtZSBmdW5jdGlvbiB0aGF0IHNob3VsZCBiZVxuICAgKiB1c2VkIHRvIHJlc3VtZSBleGVjdXRpb24uIElmIG11bHRpcGxlIGBwYXVzZSgpYCB3ZXJlIGNhbGxlZCwgYWxsIHRoZWlyIHJlc3VtZSBmdW5jdGlvbnMgbXVzdFxuICAgKiBiZSBjYWxsZWQgYmVmb3JlIHRoZSBTY2hlZHVsZXIgYWN0dWFsbHkgc3RhcnRzIG5ldyBqb2JzLiBBZGRpdGlvbmFsIGNhbGxzIHRvIHRoZSBzYW1lIHJlc3VtZVxuICAgKiBmdW5jdGlvbiB3aWxsIGhhdmUgbm8gZWZmZWN0LlxuICAgKlxuICAgKiBKb2JzIGFscmVhZHkgcnVubmluZyBhcmUgTk9UIHBhdXNlZC4gVGhpcyBpcyBwYXVzaW5nIHRoZSBzY2hlZHVsZXIgb25seS5cbiAgICovXG4gIHBhdXNlKCkge1xuICAgIGxldCBjYWxsZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wYXVzZUNvdW50ZXIrKztcblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpZiAoIWNhbGxlZCkge1xuICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICBpZiAoLS10aGlzLl9wYXVzZUNvdW50ZXIgPT0gMCkge1xuICAgICAgICAgIC8vIFJlc3VtZSB0aGUgcXVldWUuXG4gICAgICAgICAgY29uc3QgcSA9IHRoaXMuX3F1ZXVlO1xuICAgICAgICAgIHRoaXMuX3F1ZXVlID0gW107XG4gICAgICAgICAgcS5mb3JFYWNoKGZuID0+IGZuKCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSBhIGpvYiB0byBiZSBydW4sIHVzaW5nIGl0cyBuYW1lLlxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiBqb2IgdG8gYmUgcnVuLlxuICAgKiBAcGFyYW0gYXJndW1lbnQgVGhlIGFyZ3VtZW50IHRvIHNlbmQgdG8gdGhlIGpvYiB3aGVuIHN0YXJ0aW5nIGl0LlxuICAgKiBAcGFyYW0gb3B0aW9ucyBTY2hlZHVsaW5nIG9wdGlvbnMuXG4gICAqIEByZXR1cm5zIFRoZSBKb2IgYmVpbmcgcnVuLlxuICAgKi9cbiAgc2NoZWR1bGU8QSBleHRlbmRzIE1pbmltdW1Bcmd1bWVudFQsIEkgZXh0ZW5kcyBNaW5pbXVtSW5wdXRULCBPIGV4dGVuZHMgTWluaW11bU91dHB1dFQ+KFxuICAgIG5hbWU6IEpvYk5hbWUsXG4gICAgYXJndW1lbnQ6IEEsXG4gICAgb3B0aW9ucz86IFNjaGVkdWxlSm9iT3B0aW9ucyxcbiAgKTogSm9iPEEsIEksIE8+IHtcbiAgICBpZiAodGhpcy5fcGF1c2VDb3VudGVyID4gMCkge1xuICAgICAgY29uc3Qgd2FpdGFibGUgPSBuZXcgU3ViamVjdDxuZXZlcj4oKTtcbiAgICAgIHRoaXMuX3F1ZXVlLnB1c2goKCkgPT4gd2FpdGFibGUuY29tcGxldGUoKSk7XG5cbiAgICAgIHJldHVybiB0aGlzLl9zY2hlZHVsZUpvYjxBLCBJLCBPPihuYW1lLCBhcmd1bWVudCwgb3B0aW9ucyB8fCB7fSwgd2FpdGFibGUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9zY2hlZHVsZUpvYjxBLCBJLCBPPihuYW1lLCBhcmd1bWVudCwgb3B0aW9ucyB8fCB7fSwgRU1QVFkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbHRlciBtZXNzYWdlcy5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgX2ZpbHRlckpvYk91dGJvdW5kTWVzc2FnZXM8TyBleHRlbmRzIE1pbmltdW1PdXRwdXRUPihcbiAgICBtZXNzYWdlOiBKb2JPdXRib3VuZE1lc3NhZ2U8Tz4sXG4gICAgc3RhdGU6IEpvYlN0YXRlLFxuICApIHtcbiAgICBzd2l0Y2ggKG1lc3NhZ2Uua2luZCkge1xuICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk9uUmVhZHk6XG4gICAgICAgIHJldHVybiBzdGF0ZSA9PSBKb2JTdGF0ZS5RdWV1ZWQ7XG4gICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuU3RhcnQ6XG4gICAgICAgIHJldHVybiBzdGF0ZSA9PSBKb2JTdGF0ZS5SZWFkeTtcblxuICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkVuZDpcbiAgICAgICAgcmV0dXJuIHN0YXRlID09IEpvYlN0YXRlLlN0YXJ0ZWQgfHwgc3RhdGUgPT0gSm9iU3RhdGUuUmVhZHk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGEgbmV3IHN0YXRlLiBUaGlzIGlzIGp1c3QgdG8gc2ltcGxpZnkgdGhlIHJlYWRpbmcgb2YgdGhlIF9jcmVhdGVKb2IgbWV0aG9kLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlU3RhdGU8TyBleHRlbmRzIE1pbmltdW1PdXRwdXRUPihcbiAgICBtZXNzYWdlOiBKb2JPdXRib3VuZE1lc3NhZ2U8Tz4sXG4gICAgc3RhdGU6IEpvYlN0YXRlLFxuICApOiBKb2JTdGF0ZSB7XG4gICAgc3dpdGNoIChtZXNzYWdlLmtpbmQpIHtcbiAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5PblJlYWR5OlxuICAgICAgICByZXR1cm4gSm9iU3RhdGUuUmVhZHk7XG4gICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuU3RhcnQ6XG4gICAgICAgIHJldHVybiBKb2JTdGF0ZS5TdGFydGVkO1xuICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkVuZDpcbiAgICAgICAgcmV0dXJuIEpvYlN0YXRlLkVuZGVkO1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgdGhlIGpvYi5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgX2NyZWF0ZUpvYjxBIGV4dGVuZHMgTWluaW11bUFyZ3VtZW50VCwgSSBleHRlbmRzIE1pbmltdW1JbnB1dFQsIE8gZXh0ZW5kcyBNaW5pbXVtT3V0cHV0VD4oXG4gICAgbmFtZTogSm9iTmFtZSxcbiAgICBhcmd1bWVudDogQSxcbiAgICBoYW5kbGVyOiBPYnNlcnZhYmxlPEpvYkhhbmRsZXJXaXRoRXh0cmEgfCBudWxsPixcbiAgICBpbmJvdW5kQnVzOiBPYnNlcnZlcjxKb2JJbmJvdW5kTWVzc2FnZTxJPj4sXG4gICAgb3V0Ym91bmRCdXM6IE9ic2VydmFibGU8Sm9iT3V0Ym91bmRNZXNzYWdlPE8+PixcbiAgICBvcHRpb25zOiBTY2hlZHVsZUpvYk9wdGlvbnMsXG4gICk6IEpvYjxBLCBJLCBPPiB7XG4gICAgY29uc3Qgc2NoZW1hUmVnaXN0cnkgPSB0aGlzLl9zY2hlbWFSZWdpc3RyeTtcblxuICAgIGNvbnN0IGNoYW5uZWxzU3ViamVjdCA9IG5ldyBNYXA8c3RyaW5nLCBTdWJqZWN0PEpzb25WYWx1ZT4+KCk7XG4gICAgY29uc3QgY2hhbm5lbHMgPSBuZXcgTWFwPHN0cmluZywgT2JzZXJ2YWJsZTxKc29uVmFsdWU+PigpO1xuXG4gICAgbGV0IHN0YXRlID0gSm9iU3RhdGUuUXVldWVkO1xuICAgIGxldCBwaW5nSWQgPSAwO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBpbnB1dCBjaGFubmVsIGJ5IGhhdmluZyBhIGZpbHRlci5cbiAgICBjb25zdCBpbnB1dCA9IG5ldyBTdWJqZWN0PEpzb25WYWx1ZT4oKTtcbiAgICBpbnB1dC5waXBlKFxuICAgICAgc3dpdGNoTWFwKG1lc3NhZ2UgPT4gaGFuZGxlci5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoaGFuZGxlciA9PiB7XG4gICAgICAgICAgaWYgKGhhbmRsZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBKb2JEb2VzTm90RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLmlucHV0Vi5waXBlKFxuICAgICAgICAgICAgICBzd2l0Y2hNYXAodmFsaWRhdGUgPT4gdmFsaWRhdGUobWVzc2FnZSkpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKSksXG4gICAgICBmaWx0ZXIocmVzdWx0ID0+IHJlc3VsdC5zdWNjZXNzKSxcbiAgICAgIG1hcChyZXN1bHQgPT4gcmVzdWx0LmRhdGEgYXMgSSksXG4gICAgKS5zdWJzY3JpYmUoXG4gICAgICB2YWx1ZSA9PiBpbmJvdW5kQnVzLm5leHQoeyBraW5kOiBKb2JJbmJvdW5kTWVzc2FnZUtpbmQuSW5wdXQsIHZhbHVlIH0pLFxuICAgICk7XG5cbiAgICBvdXRib3VuZEJ1cyA9IGNvbmNhdChcbiAgICAgIG91dGJvdW5kQnVzLFxuICAgICAgLy8gQWRkIGFuIEVuZCBtZXNzYWdlIGF0IGNvbXBsZXRpb24uIFRoaXMgd2lsbCBiZSBmaWx0ZXJlZCBvdXQgaWYgdGhlIGpvYiBhY3R1YWxseSBzZW5kIGFuXG4gICAgICAvLyBFbmQuXG4gICAgICBoYW5kbGVyLnBpcGUoc3dpdGNoTWFwKGhhbmRsZXIgPT4ge1xuICAgICAgICBpZiAoaGFuZGxlcikge1xuICAgICAgICAgIHJldHVybiBvZjxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+KHtcbiAgICAgICAgICAgIGtpbmQ6IEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuRW5kLCBkZXNjcmlwdGlvbjogaGFuZGxlci5qb2JEZXNjcmlwdGlvbixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gRU1QVFkgYXMgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+O1xuICAgICAgICB9XG4gICAgICB9KSksXG4gICAgKS5waXBlKFxuICAgICAgZmlsdGVyKG1lc3NhZ2UgPT4gdGhpcy5fZmlsdGVySm9iT3V0Ym91bmRNZXNzYWdlcyhtZXNzYWdlLCBzdGF0ZSkpLFxuICAgICAgLy8gVXBkYXRlIGludGVybmFsIGxvZ2ljIGFuZCBKb2I8PiBtZW1iZXJzLlxuICAgICAgdGFwKG1lc3NhZ2UgPT4ge1xuICAgICAgICAvLyBVcGRhdGUgdGhlIHN0YXRlLlxuICAgICAgICBzdGF0ZSA9IHRoaXMuX3VwZGF0ZVN0YXRlKG1lc3NhZ2UsIHN0YXRlKTtcblxuICAgICAgICBzd2l0Y2ggKG1lc3NhZ2Uua2luZCkge1xuICAgICAgICAgIGNhc2UgSm9iT3V0Ym91bmRNZXNzYWdlS2luZC5DaGFubmVsQ3JlYXRlOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICAvLyBJZiBpdCBkb2Vzbid0IGV4aXN0IG9yIGl0J3MgY2xvc2VkIG9uIHRoZSBvdGhlciBlbmQuXG4gICAgICAgICAgICBpZiAoIW1heWJlU3ViamVjdCkge1xuICAgICAgICAgICAgICBjb25zdCBzID0gbmV3IFN1YmplY3Q8SnNvblZhbHVlPigpO1xuICAgICAgICAgICAgICBjaGFubmVsc1N1YmplY3Quc2V0KG1lc3NhZ2UubmFtZSwgcyk7XG4gICAgICAgICAgICAgIGNoYW5uZWxzLnNldChtZXNzYWdlLm5hbWUsIHMuYXNPYnNlcnZhYmxlKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY2FzZSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLkNoYW5uZWxNZXNzYWdlOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICBpZiAobWF5YmVTdWJqZWN0KSB7XG4gICAgICAgICAgICAgIG1heWJlU3ViamVjdC5uZXh0KG1lc3NhZ2UubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbENvbXBsZXRlOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICBpZiAobWF5YmVTdWJqZWN0KSB7XG4gICAgICAgICAgICAgIG1heWJlU3ViamVjdC5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICBjaGFubmVsc1N1YmplY3QuZGVsZXRlKG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlIEpvYk91dGJvdW5kTWVzc2FnZUtpbmQuQ2hhbm5lbEVycm9yOiB7XG4gICAgICAgICAgICBjb25zdCBtYXliZVN1YmplY3QgPSBjaGFubmVsc1N1YmplY3QuZ2V0KG1lc3NhZ2UubmFtZSk7XG4gICAgICAgICAgICBpZiAobWF5YmVTdWJqZWN0KSB7XG4gICAgICAgICAgICAgIG1heWJlU3ViamVjdC5lcnJvcihtZXNzYWdlLmVycm9yKTtcbiAgICAgICAgICAgICAgY2hhbm5lbHNTdWJqZWN0LmRlbGV0ZShtZXNzYWdlLm5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCAoKSA9PiB7XG4gICAgICAgIHN0YXRlID0gSm9iU3RhdGUuRXJyb3JlZDtcbiAgICAgIH0pLFxuXG4gICAgICAvLyBEbyBvdXRwdXQgdmFsaWRhdGlvbiAobWlnaHQgaW5jbHVkZSBkZWZhdWx0IHZhbHVlcyBzbyB0aGlzIG1pZ2h0IGhhdmUgc2lkZVxuICAgICAgLy8gZWZmZWN0cykuIFdlIGtlZXAgYWxsIG1lc3NhZ2VzIGluIG9yZGVyLlxuICAgICAgY29uY2F0TWFwKG1lc3NhZ2UgPT4ge1xuICAgICAgICBpZiAobWVzc2FnZS5raW5kICE9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk91dHB1dCkge1xuICAgICAgICAgIHJldHVybiBvZihtZXNzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBoYW5kbGVyLnBpcGUoXG4gICAgICAgICAgc3dpdGNoTWFwKGhhbmRsZXIgPT4ge1xuICAgICAgICAgICAgaWYgKGhhbmRsZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEpvYkRvZXNOb3RFeGlzdEV4Y2VwdGlvbihuYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLm91dHB1dFYucGlwZShcbiAgICAgICAgICAgICAgICBzd2l0Y2hNYXAodmFsaWRhdGUgPT4gdmFsaWRhdGUobWVzc2FnZS52YWx1ZSkpLFxuICAgICAgICAgICAgICAgIHN3aXRjaE1hcChvdXRwdXQgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKCFvdXRwdXQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgSm9iT3V0cHV0U2NoZW1hVmFsaWRhdGlvbkVycm9yKG91dHB1dC5lcnJvcnMpO1xuICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICByZXR1cm4gb2Yoe1xuICAgICAgICAgICAgICAgICAgICAuLi5tZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICBvdXRwdXQ6IG91dHB1dC5kYXRhIGFzIE8sXG4gICAgICAgICAgICAgICAgICB9IGFzIEpvYk91dGJvdW5kTWVzc2FnZU91dHB1dDxPPik7XG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICkgYXMgT2JzZXJ2YWJsZTxKb2JPdXRib3VuZE1lc3NhZ2U8Tz4+O1xuICAgICAgfSksXG4gICAgICBfam9iU2hhcmUoKSxcbiAgICApO1xuXG4gICAgY29uc3Qgb3V0cHV0ID0gb3V0Ym91bmRCdXMucGlwZShcbiAgICAgIGZpbHRlcih4ID0+IHgua2luZCA9PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk91dHB1dCksXG4gICAgICBtYXAoKHg6IEpvYk91dGJvdW5kTWVzc2FnZU91dHB1dDxPPikgPT4geC52YWx1ZSksXG4gICAgICBzaGFyZVJlcGxheSgxKSxcbiAgICApO1xuXG4gICAgLy8gUmV0dXJuIHRoZSBKb2IuXG4gICAgcmV0dXJuIHtcbiAgICAgIGdldCBzdGF0ZSgpIHsgcmV0dXJuIHN0YXRlOyB9LFxuICAgICAgYXJndW1lbnQsXG4gICAgICBkZXNjcmlwdGlvbjogaGFuZGxlci5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoaGFuZGxlciA9PiB7XG4gICAgICAgICAgaWYgKGhhbmRsZXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBKb2JEb2VzTm90RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBvZihoYW5kbGVyLmpvYkRlc2NyaXB0aW9uKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICAgIG91dHB1dCxcbiAgICAgIGdldENoYW5uZWw8VCBleHRlbmRzIEpzb25WYWx1ZT4oXG4gICAgICAgIG5hbWU6IEpvYk5hbWUsXG4gICAgICAgIHNjaGVtYTogc2NoZW1hLkpzb25TY2hlbWEgPSB0cnVlLFxuICAgICAgKTogT2JzZXJ2YWJsZTxUPiB7XG4gICAgICAgIGxldCBtYXliZU9ic2VydmFibGUgPSBjaGFubmVscy5nZXQobmFtZSk7XG4gICAgICAgIGlmICghbWF5YmVPYnNlcnZhYmxlKSB7XG4gICAgICAgICAgY29uc3QgcyA9IG5ldyBTdWJqZWN0PFQ+KCk7XG4gICAgICAgICAgY2hhbm5lbHNTdWJqZWN0LnNldChuYW1lLCBzKTtcbiAgICAgICAgICBjaGFubmVscy5zZXQobmFtZSwgcy5hc09ic2VydmFibGUoKSk7XG5cbiAgICAgICAgICBtYXliZU9ic2VydmFibGUgPSBzLmFzT2JzZXJ2YWJsZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1heWJlT2JzZXJ2YWJsZS5waXBlKFxuICAgICAgICAgIC8vIEtlZXAgdGhlIG9yZGVyIG9mIG1lc3NhZ2VzLlxuICAgICAgICAgIGNvbmNhdE1hcChcbiAgICAgICAgICAgIG1lc3NhZ2UgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gc2NoZW1hUmVnaXN0cnkuY29tcGlsZShzY2hlbWEpLnBpcGUoXG4gICAgICAgICAgICAgICAgc3dpdGNoTWFwKHZhbGlkYXRlID0+IHZhbGlkYXRlKG1lc3NhZ2UpKSxcbiAgICAgICAgICAgICAgICBmaWx0ZXIoeCA9PiB4LnN1Y2Nlc3MpLFxuICAgICAgICAgICAgICAgIG1hcCh4ID0+IHguZGF0YSBhcyBUKSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBwaW5nKCkge1xuICAgICAgICBjb25zdCBpZCA9IHBpbmdJZCsrO1xuICAgICAgICBpbmJvdW5kQnVzLm5leHQoeyBraW5kOiBKb2JJbmJvdW5kTWVzc2FnZUtpbmQuUGluZywgaWQgfSk7XG5cbiAgICAgICAgcmV0dXJuIG91dGJvdW5kQnVzLnBpcGUoXG4gICAgICAgICAgZmlsdGVyKHggPT4geC5raW5kID09PSBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLlBvbmcgJiYgeC5pZCA9PSBpZCksXG4gICAgICAgICAgZmlyc3QoKSxcbiAgICAgICAgICBpZ25vcmVFbGVtZW50cygpLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIHN0b3AoKSB7XG4gICAgICAgIGluYm91bmRCdXMubmV4dCh7IGtpbmQ6IEpvYkluYm91bmRNZXNzYWdlS2luZC5TdG9wIH0pO1xuICAgICAgfSxcbiAgICAgIGlucHV0LFxuICAgICAgaW5ib3VuZEJ1cyxcbiAgICAgIG91dGJvdW5kQnVzLFxuICAgIH07XG4gIH1cblxuICBwcm90ZWN0ZWQgX3NjaGVkdWxlSm9iPFxuICAgIEEgZXh0ZW5kcyBNaW5pbXVtQXJndW1lbnRULFxuICAgIEkgZXh0ZW5kcyBNaW5pbXVtSW5wdXRULFxuICAgIE8gZXh0ZW5kcyBNaW5pbXVtT3V0cHV0VCxcbiAgPihcbiAgICBuYW1lOiBKb2JOYW1lLFxuICAgIGFyZ3VtZW50OiBBLFxuICAgIG9wdGlvbnM6IFNjaGVkdWxlSm9iT3B0aW9ucyxcbiAgICB3YWl0YWJsZTogT2JzZXJ2YWJsZTxuZXZlcj4sXG4gICk6IEpvYjxBLCBJLCBPPiB7XG4gICAgLy8gR2V0IGhhbmRsZXIgZmlyc3QsIHNpbmNlIHRoaXMgY2FuIGVycm9yIG91dCBpZiB0aGVyZSdzIG5vIGhhbmRsZXIgZm9yIHRoZSBqb2IgbmFtZS5cbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fZ2V0SW50ZXJuYWxEZXNjcmlwdGlvbihuYW1lKTtcblxuICAgIGNvbnN0IG9wdGlvbnNEZXBzID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXBlbmRlbmNpZXMpIHx8IFtdO1xuICAgIGNvbnN0IGRlcGVuZGVuY2llcyA9IEFycmF5LmlzQXJyYXkob3B0aW9uc0RlcHMpID8gb3B0aW9uc0RlcHMgOiBbb3B0aW9uc0RlcHNdO1xuXG4gICAgY29uc3QgaW5ib3VuZEJ1cyA9IG5ldyBTdWJqZWN0PEpvYkluYm91bmRNZXNzYWdlPEk+PigpO1xuICAgIGNvbnN0IG91dGJvdW5kQnVzID0gY29uY2F0KFxuICAgICAgLy8gV2FpdCBmb3IgZGVwZW5kZW5jaWVzLCBtYWtlIHN1cmUgdG8gbm90IHJlcG9ydCBtZXNzYWdlcyBmcm9tIGRlcGVuZGVuY2llcy4gU3Vic2NyaWJlIHRvXG4gICAgICAvLyBhbGwgZGVwZW5kZW5jaWVzIGF0IHRoZSBzYW1lIHRpbWUgc28gdGhleSBydW4gY29uY3VycmVudGx5LlxuICAgICAgbWVyZ2UoLi4uZGVwZW5kZW5jaWVzLm1hcCh4ID0+IHgub3V0Ym91bmRCdXMpKS5waXBlKGlnbm9yZUVsZW1lbnRzKCkpLFxuXG4gICAgICAvLyBXYWl0IGZvciBwYXVzZSgpIHRvIGNsZWFyIChpZiBuZWNlc3NhcnkpLlxuICAgICAgd2FpdGFibGUsXG5cbiAgICAgIGZyb20oaGFuZGxlcikucGlwZShcbiAgICAgICAgc3dpdGNoTWFwKGhhbmRsZXIgPT4gbmV3IE9ic2VydmFibGUoKHN1YnNjcmliZXI6IE9ic2VydmVyPEpvYk91dGJvdW5kTWVzc2FnZTxPPj4pID0+IHtcbiAgICAgICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBKb2JEb2VzTm90RXhpc3RFeGNlcHRpb24obmFtZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVmFsaWRhdGUgdGhlIGFyZ3VtZW50LlxuICAgICAgICAgIHJldHVybiBoYW5kbGVyLmFyZ3VtZW50Vi5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKHZhbGlkYXRlID0+IHZhbGlkYXRlKGFyZ3VtZW50KSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAob3V0cHV0ID0+IHtcbiAgICAgICAgICAgICAgaWYgKCFvdXRwdXQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBKb2JBcmd1bWVudFNjaGVtYVZhbGlkYXRpb25FcnJvcihvdXRwdXQuZXJyb3JzKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGFyZ3VtZW50OiBBID0gb3V0cHV0LmRhdGEgYXMgQTtcbiAgICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRpb24gPSBoYW5kbGVyLmpvYkRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICBzdWJzY3JpYmVyLm5leHQoeyBraW5kOiBKb2JPdXRib3VuZE1lc3NhZ2VLaW5kLk9uUmVhZHksIGRlc2NyaXB0aW9uIH0pO1xuXG4gICAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzOiBbLi4uZGVwZW5kZW5jaWVzXSxcbiAgICAgICAgICAgICAgICBpbmJvdW5kQnVzOiBpbmJvdW5kQnVzLmFzT2JzZXJ2YWJsZSgpLFxuICAgICAgICAgICAgICAgIHNjaGVkdWxlcjogdGhpcyBhcyBTY2hlZHVsZXI8TWluaW11bUFyZ3VtZW50VCwgTWluaW11bUlucHV0VCwgTWluaW11bU91dHB1dFQ+LFxuICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyKGFyZ3VtZW50LCBjb250ZXh0KTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICkuc3Vic2NyaWJlKHN1YnNjcmliZXIpO1xuICAgICAgICB9KSksXG4gICAgICApLFxuICAgICk7XG5cbiAgICByZXR1cm4gdGhpcy5fY3JlYXRlSm9iKG5hbWUsIGFyZ3VtZW50LCBoYW5kbGVyLCBpbmJvdW5kQnVzLCBvdXRib3VuZEJ1cywgb3B0aW9ucyk7XG4gIH1cbn1cbiJdfQ==