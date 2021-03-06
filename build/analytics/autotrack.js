'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

// Import the individual autotrack plugins you want to use.
// import 'autotrack/lib/plugins/clean-url-tracker';
// import 'autotrack/lib/plugins/max-scroll-tracker';
// import 'autotrack/lib/plugins/outbound-link-tracker';
// import 'autotrack/lib/plugins/page-visibility-tracker';
// import 'autotrack/lib/plugins/url-change-tracker';

/* global define, fbq, ga */

var TRACKING_ID_FBQ = void 0;

/**
 * The tracking ID for your Google Analytics property.
 * https://support.google.com/analytics/answer/1032385
 */
var TRACKING_ID_GA = void 0;

/**
 * Bump this when making backwards incompatible changes to the tracking
 * implementation. This allows you to create a segment or view filter
 * that isolates only data captured with the most recent tracking changes.
 */
var TRACKING_VERSION = '1';

var TRACKING_TIME_ZONE = 'America/Los_Angeles';

/**
 * A default value for dimensions so unset values always are reported as
 * something. This is needed since Google Analytics will drop empty dimension
 * values in reports.
 */
var NULL_VALUE = '(not set)';

var hasWindow = function hasWindow() {
  return (typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window;
};
var hasFbq = function hasFbq() {
  return typeof window.fbq === 'function' && window.fbq;
};
var hasGa = function hasGa() {
  return typeof window.ga === 'function' && window.ga;
};
var hasBoth = function hasBoth() {
  return hasFbq() && hasGa();
};
// const fbqLoaded = () => fbq && fbq.loaded;
// const gaLoaded = () => ga && ga.loaded;


/**
 * A mapping between custom dimension names and their indexes.
 */
var dimensions = {
  TRACKING_VERSION: 'dimension1',
  CLIENT_ID: 'dimension2',
  WINDOW_ID: 'dimension3',
  HIT_ID: 'dimension4',
  HIT_TIME: 'dimension5',
  HIT_TYPE: 'dimension6',
  HIT_SOURCE: 'dimension7',
  VISIBILITY_STATE: 'dimension8',
  URL_QUERY_PARAMS: 'dimension9'
};

/**
 * A mapping between custom metric names and their indexes.
 */
var metrics = {
  RESPONSE_END_TIME: 'metric1',
  DOM_LOAD_TIME: 'metric2',
  WINDOW_LOAD_TIME: 'metric3',
  PAGE_VISIBLE: 'metric4',
  MAX_SCROLL_PERCENTAGE: 'metric5',
  PAGE_LOADS: 'metric6'
};

/**
 * Initializes all the analytics setup. Creates trackers and sets initial
 * values on the trackers.
 */
var init = function init(_ref) {
  var _ref$FBQ = _ref.FBQ,
      FBQ = _ref$FBQ === undefined ? TRACKING_ID_FBQ : _ref$FBQ,
      _ref$GA = _ref.GA,
      GA = _ref$GA === undefined ? TRACKING_ID_GA : _ref$GA,
      _ref$TV = _ref.TV,
      TV = _ref$TV === undefined ? TRACKING_VERSION : _ref$TV,
      _ref$TZ = _ref.TZ,
      TZ = _ref$TZ === undefined ? TRACKING_TIME_ZONE : _ref$TZ;

  TRACKING_ID_FBQ = FBQ;
  TRACKING_ID_GA = GA;
  TRACKING_VERSION = TV;
  TRACKING_TIME_ZONE = TZ;

  hasBoth() && function () {
    // Initialize the command queue in case analytics.js hasn't loaded yet.
    window.ga = window.ga || function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return (ga.q = ga.q || []).push(args);
    };

    createTracker();
    trackErrors();
    trackCustomDimensions();
    requireAutotrackPlugins();
    sendInitialPageview();
    sendNavigationTimingMetrics();
  }();
};

/**
 * Tracks a JavaScript error with optional fields object overrides.
 * This function is exported so it can be used in other parts of the codebase.
 * E.g.:
 *
 *    `fetch('/api.json').catch(trackError);`
 *
 * @param {(Error|Object)=} err
 * @param {Object=} fieldsObj
 */
var trackError = function trackError() {
  var err = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var fieldsObj = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  hasGa() && ga('send', 'event', Object.assign({
    eventCategory: 'Error',
    eventAction: err.name || '(no error name)',
    eventLabel: err.message + '\n' + (err.stack || '(no stack trace)'),
    nonInteraction: true
  }, fieldsObj));
};

/**
 * Creates the trackers and sets the default transport and tracking
 * version fields. In non-production environments it also logs hits.
 */
var createTracker = function createTracker() {
  ga('create', TRACKING_ID_GA, 'auto');

  // Ensures all hits are sent via `navigator.sendBeacon()`.
  ga('set', 'transport', 'beacon');

  fbq('init', TRACKING_ID_FBQ);
};

/**
 * Tracks any errors that may have occured on the page prior to analytics being
 * initialized, then adds an event handler to track future errors.
 */
var trackErrors = function trackErrors() {
  // Errors that have occurred prior to this script running are stored on
  // `window.__e.q`, as specified in `index.html`.
  var loadErrorEvents = window.__e && window.__e.q || [];

  var trackErrorEvent = function trackErrorEvent(event) {
    // Use a different eventCategory for uncaught errors.
    var fieldsObj = { eventCategory: 'Uncaught Error' };

    // Some browsers don't have an error property, so we fake it.
    var err = event.error || {
      message: event.message + ' (' + event.lineno + ':' + event.colno + ')'
    };

    trackError(err, fieldsObj);
  };

  // Replay any stored load error events.
  for (var _iterator = loadErrorEvents, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref2;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref2 = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref2 = _i.value;
    }

    var event = _ref2;

    trackErrorEvent(event);
  }

  // Add a new listener to track event immediately.
  window.addEventListener('error', trackErrorEvent);
};

/**
 * Sets a default dimension value for all custom dimensions on all trackers.
 */
var trackCustomDimensions = function trackCustomDimensions() {
  // Sets a default dimension value for all custom dimensions to ensure
  // that every dimension in every hit has *some* value. This is necessary
  // because Google Analytics will drop rows with empty dimension values
  // in your reports.
  Object.keys(dimensions).forEach(function (key) {
    ga('set', dimensions[key], NULL_VALUE);
  });

  // Adds tracking of dimensions known at page load time.
  ga(function (tracker) {
    var _tracker$set;

    tracker.set((_tracker$set = {}, _tracker$set[dimensions.TRACKING_VERSION] = TRACKING_VERSION, _tracker$set[dimensions.CLIENT_ID] = tracker.get('clientId'), _tracker$set[dimensions.WINDOW_ID] = uuid(), _tracker$set));
  });

  // Adds tracking to record each the type, time, uuid, and visibility state
  // of each hit immediately before it's sent.
  ga(function (tracker) {
    var originalBuildHitTask = tracker.get('buildHitTask');
    tracker.set('buildHitTask', function (model) {
      var qt = model.get('queueTime') || 0;
      model.set(dimensions.HIT_TIME, String(new Date() - qt), true);
      model.set(dimensions.HIT_ID, uuid(), true);
      model.set(dimensions.HIT_TYPE, model.get('hitType'), true);
      model.set(dimensions.VISIBILITY_STATE, document.visibilityState, true);

      originalBuildHitTask(model);
    });
  });
};

/**
 * Requires select autotrack plugins and initializes each one with its
 * respective configuration options.
 */
var requireAutotrackPlugins = function requireAutotrackPlugins() {
  var _fieldsObj, _fieldsObj2;

  ga('require', 'cleanUrlTracker', {
    stripQuery: true,
    queryDimensionIndex: getDefinitionIndex(dimensions.URL_QUERY_PARAMS),
    trailingSlash: 'remove'
  });
  ga('require', 'maxScrollTracker', {
    sessionTimeout: 30,
    timeZone: TRACKING_TIME_ZONE,
    maxScrollMetricIndex: getDefinitionIndex(metrics.MAX_SCROLL_PERCENTAGE)
  });
  ga('require', 'outboundLinkTracker', {
    events: ['click', 'contextmenu']
  });
  ga('require', 'pageVisibilityTracker', {
    sendInitialPageview: true,
    pageLoadsMetricIndex: getDefinitionIndex(metrics.PAGE_LOADS),
    visibleMetricIndex: getDefinitionIndex(metrics.PAGE_VISIBLE),
    timeZone: TRACKING_TIME_ZONE,
    fieldsObj: (_fieldsObj = {}, _fieldsObj[dimensions.HIT_SOURCE] = 'pageVisibilityTracker', _fieldsObj)
  });
  ga('require', 'urlChangeTracker', {
    fieldsObj: (_fieldsObj2 = {}, _fieldsObj2[dimensions.HIT_SOURCE] = 'urlChangeTracker', _fieldsObj2)
  });
};

/**
 * Sends the initial pageview to Google Analytics.
 */
var sendInitialPageview = function sendInitialPageview() {
  fbq('track', 'PageView');
};

/**
 * Gets the DOM and window load times and sends them as custom metrics to
 * Google Analytics via an event hit.
 */
var sendNavigationTimingMetrics = function sendNavigationTimingMetrics() {
  // Only track performance in supporting browsers.
  if (!(window.performance && window.performance.timing)) return;

  // If the window hasn't loaded, run this function after the `load` event.
  if (document.readyState != 'complete') {
    window.addEventListener('load', sendNavigationTimingMetrics);
    return;
  }

  var nt = performance.timing;
  var navStart = nt.navigationStart;

  var responseEnd = Math.round(nt.responseEnd - navStart);
  var domLoaded = Math.round(nt.domContentLoadedEventStart - navStart);
  var windowLoaded = Math.round(nt.loadEventStart - navStart);

  // In some edge cases browsers return very obviously incorrect NT values,
  // e.g. 0, negative, or future times. This validates values before sending.
  var allValuesAreValid = function allValuesAreValid() {
    for (var _len2 = arguments.length, values = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      values[_key2] = arguments[_key2];
    }

    return values.every(function (value) {
      return value > 0 && value < 6e6;
    });
  };

  if (allValuesAreValid(responseEnd, domLoaded, windowLoaded)) {
    var _ga;

    ga('send', 'event', (_ga = {
      eventCategory: 'Navigation Timing',
      eventAction: 'track',
      eventLabel: NULL_VALUE,
      nonInteraction: true
    }, _ga[metrics.RESPONSE_END_TIME] = responseEnd, _ga[metrics.DOM_LOAD_TIME] = domLoaded, _ga[metrics.WINDOW_LOAD_TIME] = windowLoaded, _ga));
  }
};

/**
 * Accepts a custom dimension or metric and returns it's numerical index.
 * @param {string} definition The definition string (e.g. 'dimension1').
 * @return {number} The definition index.
 */
var getDefinitionIndex = function getDefinitionIndex(definition) {
  return +/\d+$/.exec(definition)[0];
};

/**
 * Generates a UUID.
 * https://gist.github.com/jed/982883
 * @param {string|undefined=} a
 * @return {string}
 */
var uuid = function b(a) {
  return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b);
};

var trackEvent = function trackEvent(_ref3, trackFbq) {
  var eventCategory = _ref3.eventCategory,
      eventAction = _ref3.eventAction,
      _ref3$eventLabel = _ref3.eventLabel,
      eventLabel = _ref3$eventLabel === undefined ? NULL_VALUE : _ref3$eventLabel;

  hasGa() && ga('send', 'event', {
    eventCategory: eventCategory,
    eventAction: eventAction,
    eventLabel: eventLabel
  });

  hasFbq() && trackFbq && fbq('trackCustom', eventCategory, {
    eventAction: eventAction,
    eventLabel: eventLabel
  });
};

var trackPageview = function trackPageview(pathname) {
  hasGa() && ga('send', 'pageview', pathname);

  hasFbq() && fbq('track', 'PageView');
};

var func = { init: init, trackError: trackError, trackEvent: trackEvent, trackPageview: trackPageview };

(function (name, context, definition) {
  if ((typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object' && exports && typeof exports.nodeName !== 'string') {
    Object.assign(exports, definition(true));
  } else if (typeof define === 'function' && define.amd) {
    define('analytics', function () {
      return definition(true);
    });
  } else {
    context[name] = definition(false);
  }
})('analytics', this, function (def) {
  // eslint-disable-line no-invalid-this
  var analytics = Object.assign.apply(Object, Object.keys(func).map(function (e) {
    var _ref4;

    return _ref4 = {}, _ref4[e] = hasWindow() ? func[e] : function () {}, _ref4;
  }));
  if (def) {
    return _extends({}, analytics, { default: analytics });
  }
  return analytics;
});
