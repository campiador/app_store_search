// exports.myDateTime = function () {
//     return Date();
// };

var argv = process.argv.slice(2);

if (argv.length < 3) {
	console.log("Error: Not enough input arguments!");
	return;
}

else if (argv.length == 3) {
	var input_term = argv[0];
	var input_limit = argv[1];
	var input_store = argv[2];
}	

else {
	console.log("Error: Two many input arguments!")
	return;
}


function save_std(data) {
	var json_string_results = JSON.stringify(data);
	console.log(json_string_results);
}


function save_err(data) {
	console.log("NodeJS> Error! " + data);
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


