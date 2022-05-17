var http = require("http");
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: true });

const PORT = process.env.PORT || 5000;

// Running Server Details.
var server = app.listen(PORT, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Example app listening at %s:%s Port", host, port)
});


app.get('/', function (req, res) {
      res.sendfile('search_form.html');
});


app.get('/search_results', function (req, res) {

    var input_term = req.query.search_query;
    var input_limit = req.query.n_results;
    var input_store = req.query.os;

    function save_std(data, selected_os) {

	//var p1 = window.document.getElementById("p_1");
	//p1.innerHTML = "Search finished!";
    	var json_string_results = JSON.stringify(data);
    	console.log(json_string_results);

      /*
      if (selected_os == "ios") {

          for (var app in data) {

            var ratingCount = get_ios_rating(app["id"]);

          }

      }*/

    	var csv_data = json_to_csv(data);
    	console.log(csv_data);


    	res.attachment(input_term + "_" + input_limit + "_" + input_store +'.csv');
    	res.status(200).send(csv_data);
    }

    function json_to_csv(data)
    {
    	const json2csv = require('json2csv').parse;
    	var summary_or_description = "summary";
    	if (input_store == "ios") {
    	    summary_or_description = "description";
    	}
      function epochToStr(epochDate) {
        var d = new Date(epochDate);
        var dateStr = d.toISOString().split('T')[0];
        return dateStr;
      }

      function transDateAndroid(lastUpdateEpoch) {
        try {
          var stringDate = epochToStr(lastUpdateEpoch);
          return stringDate;
        } catch (e) {

        } finally {

        }
        return lastUpdateEpoch;
      }


    	const fields = ["title", "developer",
      {
        label: "summary",
        value: (row, field) => input_store == "ios" ? "N/A" : row.summary

      },
      "appId", "description", "score", "ratings",

      {
        label: "size",
        value: (row, field) => input_store == "ios" ?
        parseFloat(row.size / 1000000).toFixed(2) + "M" : row.size

      },

      {
        label: "min installs",
        value: (row, field) => input_store == "ios" ? "N/A" : row.minInstalls

      },

      {
        label: "max installs",
        value: (row, field) => input_store == "ios" ? "N/A" : row.maxInstalls

      },
      {
        label: "last updated",
        value: (row, field) => transDateAndroid(row.updated)
      },
      "version", "contentRating", "url"]; //TODO: , "search term", "rank"]

    	const opts = { fields };

    	const transformOpts = { highWaterMark: 16384, encoding: 'utf8'};

    	try {
    	    const csv = json2csv(data, opts, transformOpts);
    	    console.log(csv);
    	    return csv;

    	} catch (err) {
    	    console.error(err);
    	    console.log("Error happened in json2csv!");
    	}

    }

    function save_err(data) {
  	console.log("NodeJS> Error! " + data);
  	res.send("Error in Node.JS! Contact admin!")
    }

    if (input_store == "android") {
    	try {
    		var gplay = require('google-play-scraper');
    	}  catch(e) {
    		console.error(e.message);
    		console.error("google-play-scraper is probably not found. Try running `npm i google-play-scraper`.");
    		process.exit(e.code);
    	}

    	gplay.search({
        	term: input_term,
       	 num: input_limit,
         fullDetail: true
      	}).then(save_std, save_err);
    }

    else { //input == "ios"

    	try {
    		var appleStore = require('app-store-scraper');
    	}  catch(e) {
    		console.error(e.message);
    		console.error("app-store-scraper is probably not found. Try running `npm i app-store-scraper`.");
    		process.exit(e.code);
    	}

    	appleStore.search({
        	 term: input_term,
         	 num: input_limit,
      	   page: 1,
      	   country: 'us'
      	})
        // the async function waits and gets all the ratings first
        .then(async function (data) {return await get_all_ratings(data, appleStore)})
        .catch(console.log("error getting apple store ratings"))
        .then(function (data) {return save_std(data, "ios")}, save_err);
    }

});


async function get_all_ratings(apps, appStore) {

  return new Promise(async function(resolve, reject) {

    const ratingPromiseList = [];
    //console.log(apps);
    apps.forEach((app, i) => {
      //console.log(app);
      let app_id_code = app["id"];

      let app_rating = appStore.ratings({
          id: app_id_code,
        });

      ratingPromiseList.push(app_rating);
    });

    await Promise.all(ratingPromiseList).then((values) => {
        for (let i = 0; i < values.length; i++) {
          console.log(i + ". app id: " + apps[i]["id"] + ", ratings: " + values[i]["ratings"]);
          apps[i]["ratings"] = values[i]["ratings"];
        }
        console.log("about to resolve");
        resolve(apps);
    }).catch(err => reject(apps));

    console.log("returned here");

    });


}
