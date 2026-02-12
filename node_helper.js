/* Magic Mirror
 * Module: MMM-DynamicWeather
 *
 * By Scott Lewis - https://github.com/scottcl88/MMM-DynamicWeather
 * MIT Licensed.
 *
 * Extension helper module to call external resources
 */

const NodeHelper = require("node_helper");
const https = require('https');

const REQUEST_TIMEOUT_MS = 15000;

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

module.exports = NodeHelper.create({
  start: function () { },

  callApi: function (url) {
    console.info("[MMM-DynamicWeather] Getting Weather API data");

    const req = https.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { this.handleApiResponse(res, body, url); });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      console.error("[MMM-DynamicWeather] API request timed out");
      req.destroy(new Error("API request timed out"));
    });

    req.on('error', (error) => {
      console.error("[MMM-DynamicWeather] Failed getting api: ", error);
      this.sendSocketNotification("API-Received", { url, result: null, success: false, error: String(error && error.message ? error.message : error) });
    });
  },

  handleApiResponse: function (res, body, url) {
    let success = false;
    let result = null;

    if (res.statusCode !== 200) {
      console.error("[MMM-DynamicWeather] Failed getting api: ", res.statusCode);
      // Still try to parse any response body for error details.
    } else {
      console.info("[MMM-DynamicWeather] Received successful Weather API data");
      success = true;
    }

    if (body && body.trim().length > 0) {
      const parsed = safeJsonParse(body);
      if (parsed.ok) {
        result = parsed.value;
      } else {
        console.error("[MMM-DynamicWeather] Failed parsing API JSON response:", parsed.error);
        success = false;
        this.sendSocketNotification("API-Received", { url, result: null, success: false, error: "Failed parsing API JSON response" });
        return;
      }
    }

    this.sendSocketNotification("API-Received", { url, result, success });
  },

  callHoliday: function () {
    const url = "https://www.timeanddate.com/holidays/us/?hol=43122559";
    console.info("[MMM-DynamicWeather] Getting Holiday data");

    const req = https.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { this.handleHolidayResponse(res, body); });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      console.error("[MMM-DynamicWeather] Holiday request timed out");
      req.destroy(new Error("Holiday request timed out"));
    });

    req.on('error', (error) => {
      console.error("[MMM-DynamicWeather] Failed getting holidays: ", error);
      this.sendSocketNotification("Holiday-Received", { result: { holidayBody: "" }, success: false, error: String(error && error.message ? error.message : error) });
    });
  },

  handleHolidayResponse: function (res, body) {
    let success = false;

    if (res.statusCode !== 200) {
      console.error("[MMM-DynamicWeather] Failed getting holidays: ", res.statusCode);
    } else {
      console.info("[MMM-DynamicWeather] Received successful Holiday data");
      success = true;
    }

    this.sendSocketNotification("Holiday-Received", { result: { holidayBody: body || "" }, success });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "API-Fetch") {
      this.callApi(payload);
    } else if (notification === "Holiday-Fetch") {
      this.callHoliday();
    }
  }
});
