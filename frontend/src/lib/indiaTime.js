/**
 * NEXUS ESPORTS — India time everywhere
 *
 * The platform shows every date and time in IST, whatever the viewer's device is
 * set to. Pages format dates with toLocale*String, so the default zone is set
 * once here; a call that passes its own timeZone still wins.
 */
const INDIA_TIME_ZONE = 'Asia/Kolkata';

['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach((method) => {
  const original = Date.prototype[method];
  Date.prototype[method] = function toIndiaLocale(locales, options) {
    return original.call(this, locales, { timeZone: INDIA_TIME_ZONE, ...options });
  };
});
