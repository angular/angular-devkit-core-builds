"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAnalytics = void 0;
/**
 * Analytics implementation that reports to multiple analytics backend.
 */
class MultiAnalytics {
    constructor(_backends = []) {
        this._backends = _backends;
    }
    push(...backend) {
        this._backends.push(...backend);
    }
    event(category, action, options) {
        this._backends.forEach(be => be.event(category, action, options));
    }
    screenview(screenName, appName, options) {
        this._backends.forEach(be => be.screenview(screenName, appName, options));
    }
    pageview(path, options) {
        this._backends.forEach(be => be.pageview(path, options));
    }
    timing(category, variable, time, options) {
        this._backends.forEach(be => be.timing(category, variable, time, options));
    }
    flush() {
        return Promise.all(this._backends.map(x => x.flush())).then(() => { });
    }
}
exports.MultiAnalytics = MultiAnalytics;
