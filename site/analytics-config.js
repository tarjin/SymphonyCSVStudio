/* SymphonyCSV LABS analytics — public runtime configuration.
 * Enabled after verifying the Cloudflare Worker, D1 binding, one successful write, and removal of the synthetic test.
 * Never put tokens, credentials, user identifiers, or project data here.
 */
(function (host) {
  'use strict';
  host.SymphonyCSVAnalyticsConfig = Object.freeze({
    enabled: true,
    endpoint: 'https://symphonycsv-usage-api.tarjin.workers.dev/v1/event'
  });
})(window);
