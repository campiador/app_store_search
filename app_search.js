var http = require("http");
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: true });
 
// Running Server Details.
var server = app.listen(50001, function () {
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

    function json_to_csv(data)
    {
	const json2csv = require('json2csv').parse;
	var summary_or_description = "summary";
	if (input_store == "ios") {
	    summary_or_description = "description";
	}
	
	
	const fields = ["title", "developer", summary_or_description]; //TODO: , "search term", "rank"]

	const opts = { fields };

	const transformOpts = { highWaterMark: 16384, encoding: 'utf8' };

	try {
	    const csv = json2csv(data, opts, transformOpts);
	    console.log(csv);
	    return csv;

	} catch (err) {
	    console.error(err);
	    console.log("Error happened in json2csv!");
	}

    }

    function save_std(data) {
	
	//var p1 = window.document.getElementById("p_1");
	//p1.innerHTML = "Search finished!";

	var json_string_results = JSON.stringify(data);
	console.log(json_string_results);

	var csv_data = json_to_csv(data);
	console.log(csv_data);


	res.attachment(input_term + "_" + input_limit + "_" + input_store +'.csv');
	res.status(200).send(csv_data);
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
   	 num: input_limit
  	}).then(save_std, save_err);
    }

    else { //input == "ios"

	try {
		var store = require('app-store-scraper');
	}  catch(e) {
		console.error(e.message);
		console.error("app-store-scraper is probably not found. Try running `npm i app-store-scraper`.");
		process.exit(e.code);
	}

	store.search({
    	term: input_term,
   	num: input_limit,
	page: 1,
	country: 'us',
	lang: 'lang'
  	}).then(save_std, save_err);
    }

});


