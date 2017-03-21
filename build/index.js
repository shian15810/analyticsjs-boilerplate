'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Import the individual autotrack plugins you want to use.
// import 'autotrack/lib/plugins/clean-url-tracker';
// import 'autotrack/lib/plugins/max-scroll-tracker';
// import 'autotrack/lib/plugins/outbound-link-tracker';
// import 'autotrack/lib/plugins/page-visibility-tracker';
// import 'autotrack/lib/plugins/url-change-tracker';


/* eslint-disable */
/* global ga, fbq */

/**
 * The tracking ID for your Google Analytics property.
 * https://support.google.com/analytics/answer/1032385
 */
var TRACKING_ID = process.env.REACT_APP_GA || process.env.GA;

/**
 * Bump this when making backwards incompatible changes to the tracking
 * implementation. This allows you to create a segment or view filter
 * that isolates only data captured with the most recent tracking changes.
 */
var TRACKING_VERSION = process.env.REACT_APP_TV || process.env.TV || '1';

/**
 * A default value for dimensions so unset values always are reported as
 * something. This is needed since Google Analytics will drop empty dimension
 * values in reports.
 */
var NULL_VALUE = '(not set)';

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
  MAX_SCROLL_PERCENTAGE: 'metric5'
};

/**
 * Initializes all the analytics setup. Creates trackers and sets initial
 * values on the trackers.
 */
var init = exports.init = function init() {
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
};

/**
 * Tracks a JavaScript error with optional fields object overrides.
 * This function is exported so it can be used in other parts of the codebase.
 * E.g.:
 *
 *    `fetch('/api.json').catch(trackError);`
 *
 * @param {Error|undefined} err
 * @param {Object=} fieldsObj
 */
var trackError = exports.trackError = function trackError(err) {
  var fieldsObj = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  ga('send', 'event', Object.assign({
    eventCategory: 'Error',
    eventAction: err.name,
    eventLabel: err.message + '\n' + (err.stack || '(no stack trace)'),
    nonInteraction: true
  }, fieldsObj));
};

/**
 * Creates the trackers and sets the default transport and tracking
 * version fields. In non-production environments it also logs hits.
 */
var createTracker = function createTracker() {
  ga('create', TRACKING_ID, 'auto');

  // Ensures all hits are sent via `navigator.sendBeacon()`.
  ga('set', 'transport', 'beacon');

  fbq('init', process.env.REACT_APP_FBQ || process.env.FBQ);
};

/**
 * Tracks any errors that may have occured on the page prior to analytics being
 * initialized, then adds an event handler to track future errors.
 */
var trackErrors = function trackErrors() {
  // Errors that have occurred prior to this script running are stored on
  // `window.__e.q`, as specified in `index.html`.
  var loadErrorEvents = window.__e && window.__e.q || [];

  // Use a different eventCategory for uncaught errors.
  var fieldsObj = { eventCategory: 'Uncaught Error' };

  // Replay any stored load error events.
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = loadErrorEvents[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var event = _step.value;

      trackError(event.error, fieldsObj);
    }

    // Add a new listener to track event immediately.
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  window.addEventListener('error', function (event) {
    trackError(event.error, fieldsObj);
  });
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

    tracker.set((_tracker$set = {}, _defineProperty(_tracker$set, dimensions.TRACKING_VERSION, TRACKING_VERSION), _defineProperty(_tracker$set, dimensions.CLIENT_ID, tracker.get('clientId')), _defineProperty(_tracker$set, dimensions.WINDOW_ID, uuid()), _tracker$set));
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
  ga('require', 'cleanUrlTracker', {
    stripQuery: true,
    queryDimensionIndex: getDefinitionIndex(dimensions.URL_QUERY_PARAMS),
    trailingSlash: 'remove'
  });
  ga('require', 'maxScrollTracker', {
    sessionTimeout: 30,
    timeZone: process.env.REACT_APP_TZ || process.env.TZ || 'America/Los_Angeles',
    maxScrollMetricIndex: getDefinitionIndex(metrics.MAX_SCROLL_PERCENTAGE)
  });
  ga('require', 'outboundLinkTracker', {
    events: ['click', 'contextmenu']
  });
  ga('require', 'pageVisibilityTracker', {
    visibleMetricIndex: getDefinitionIndex(metrics.PAGE_VISIBLE),
    sessionTimeout: 30,
    timeZone: process.env.REACT_APP_TZ || process.env.TZ || 'America/Los_Angeles',
    fieldsObj: _defineProperty({}, dimensions.HIT_SOURCE, 'pageVisibilityTracker')
  });
  ga('require', 'urlChangeTracker', {
    fieldsObj: _defineProperty({}, dimensions.HIT_SOURCE, 'urlChangeTracker')
  });
};

/**
 * Sends the initial pageview to Google Analytics.
 */
var sendInitialPageview = function sendInitialPageview() {
  ga('send', 'pageview', _defineProperty({}, dimensions.HIT_SOURCE, 'pageload'));

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
    var _ga2;

    ga('send', 'event', (_ga2 = {
      eventCategory: 'Navigation Timing',
      eventAction: 'track',
      nonInteraction: true
    }, _defineProperty(_ga2, metrics.RESPONSE_END_TIME, responseEnd), _defineProperty(_ga2, metrics.DOM_LOAD_TIME, domLoaded), _defineProperty(_ga2, metrics.WINDOW_LOAD_TIME, windowLoaded), _ga2));
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

var trackEvent = exports.trackEvent = function trackEvent(eventCategory, eventAction) {
  var eventLabel = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : NULL_VALUE;
  var trackFbq = arguments[3];

  ga('send', 'event', {
    eventCategory: eventCategory,
    eventAction: eventAction,
    eventLabel: eventLabel
  });

  trackFbq && fbq('trackCustom', eventCategory, {
    eventAction: eventAction,
    eventLabel: eventLabel
  });
};

var trackPageview = exports.trackPageview = function trackPageview(pathname) {
  ga('send', 'pageview', pathname);

  fbq('track', 'PageView');
};

exports.default = { init: init, trackError: trackError, trackEvent: trackEvent, trackPageview: trackPageview };
