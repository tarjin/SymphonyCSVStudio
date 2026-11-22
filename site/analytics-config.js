/* SymphonyCSV LABS analytics — public runtime configuration.
 * OFF by default. Once a real Cloudflare Worker exists, edit this file alone.
 * Never put tokens, credentials, user identifiers, or project data here.
 */
(function (host) {
  'use strict';
  host.SymphonyCSVAnalyticsConfig = Object.freeze({
    enabled: false,
    endpoint: ''
  });
})(window);
