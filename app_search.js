var express = require('express');
var path = require('path');
var appleStore = require('app-store-scraper');
const json2csv = require('json2csv').parse;
var gplay; // google-play-scraper v10 is an ES module, loaded before the server starts

var app = express();

const PORT = process.env.PORT || 5000;
// The paper used 200 results per search. Google Play allows up to 250 (but currently
// returns only about 30); the Apple App Store returns about 200 at most.
const MAX_RESULTS = 200;

var server;
import('google-play-scraper').then(function (mod) {
  gplay = mod.default;
  server = app.listen(PORT, function () {
    console.log("App search listening on port %s", server.address().port);
  });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'search_form.html'));
});

app.get('/search_results', function (req, res) {

  var input_term = String(req.query.search_query || '').trim();
  var input_limit = parseInt(req.query.n_results, 10);
  var input_store = req.query.os === 'ios' ? 'ios' : 'android';

  if (!input_term) {
    return res.status(400).type('text').send('Please enter a search query.');
  }
  if (!(input_limit >= 1 && input_limit <= MAX_RESULTS)) {
    return res.status(400).type('text').send('Number of results must be between 1 and ' + MAX_RESULTS + '.');
  }

  var search_date = new Date().toISOString().split('T')[0];
  console.log("Search: store=%s term=%j n=%d", input_store, input_term, input_limit);

  function send_csv(data) {
    var csv_data = json_to_csv(data);
    console.log("Search finished: %d results", data.length);
    var safe_term = input_term.replace(/[^A-Za-z0-9-]+/g, '_');
    res.attachment(safe_term + "_" + input_limit + "_" + input_store + '.csv');
    res.status(200).send(csv_data);
  }

  function send_error(err) {
    console.error("Search failed:", err);
    if (!res.headersSent) {
      res.status(502).type('text').send('The ' + (input_store === 'ios' ? 'Apple App Store' : 'Google Play') +
        ' search failed (' + (err && err.message ? err.message : err) + ').');
    }
  }

  function epochToStr(epochDate) {
    return new Date(epochDate).toISOString().split('T')[0];
  }

  function transDateAndroid(lastUpdateEpoch) {
    if (lastUpdateEpoch === undefined || lastUpdateEpoch === null) { return "N/A"; }
    try {
      return epochToStr(lastUpdateEpoch);
    } catch (e) {
      return lastUpdateEpoch;
    }
  }

  function json_to_csv(data) {
    data.forEach(function (row, i) { row._rank = i + 1; });

    const fields = ["title", "developer",
      {
        label: "summary",
        value: (row) => input_store == "ios" ? "N/A" : row.summary
      },
      "appId", "description", "score", "ratings",
      {
        label: "size",
        value: (row) => input_store == "ios" ?
          parseFloat(row.size / 1000000).toFixed(2) + "M" :
          // Google Play no longer publishes app size
          (row.size === undefined ? "N/A" : row.size)
      },
      {
        label: "min installs",
        value: (row) => input_store == "ios" ? "N/A" : row.minInstalls
      },
      {
        label: "max installs",
        value: (row) => input_store == "ios" ? "N/A" : row.maxInstalls
      },
      {
        label: "last updated",
        value: (row) => transDateAndroid(row.updated)
      },
      "version", "contentRating", "url", "price",
      { label: "search term", value: () => input_term },
      { label: "rank", value: "_rank" },
      { label: "search date", value: () => search_date }
    ];

    return json2csv(data, { fields });
  }

  if (input_store == "android") {
    gplay.search({
      term: input_term,
      num: input_limit
    })
      .then(add_android_details)
      .then(send_csv)
      .catch(send_error);
  }
  else { // ios
    appleStore.search({
      term: input_term,
      num: input_limit,
      page: 1,
      country: 'us'
    })
      .then(function (data) { return add_ios_ratings(data, appleStore); })
      .then(send_csv)
      .catch(send_error);
  }
});

/* Google Play search results only have basic fields, so look up each app's full details
   (what fullDetail: true used to do). Each lookup is retried; if it still fails, the app keeps
   its basic search fields instead of failing the whole search. A few lookups run at a time. */
async function add_android_details(apps) {
  const CONCURRENCY = 10;
  const ATTEMPTS = 3;
  const detailed = new Array(apps.length);
  let next = 0;
  let failed = 0;

  async function lookup(app) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        return Object.assign({}, app, await gplay.app({ appId: app.appId }));
      } catch (e) {
        if (attempt === ATTEMPTS) {
          failed++;
          console.error("Details failed for %s: %s", app.appId, e.message);
          return app;
        }
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  async function worker() {
    while (next < apps.length) {
      const i = next++;
      detailed[i] = await lookup(apps[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, apps.length) }, worker));
  if (failed) { console.log("%d of %d apps are missing full details", failed, apps.length); }
  return detailed;
}

/* Apple's search results don't include the number of ratings, so look each app up.
   If a lookup fails, that app's rating count is reported as N/A instead of failing the search. */
async function add_ios_ratings(apps, appStore) {
  const results = await Promise.allSettled(
    apps.map((app) => appStore.ratings({ id: app.id }))
  );
  results.forEach((result, i) => {
    apps[i].ratings = result.status === 'fulfilled' ? result.value.ratings : 'N/A';
  });
  return apps;
}
