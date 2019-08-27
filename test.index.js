const DATASTORE = require('./index.js');
let DataBase = new DATASTORE({dbname:'_test'});
DataBase.then(function(db){
	
	//error stream
	db.on('data', function(buffer){
		console.log(buffer);
	});
	
	//insert (or update if exists) one document from database
	db.insertOne({_id: "sdasdasdas", text:"test", data: Date.now()}).then(function(_id){
		console.log(_id);
		return new Promise(function(res, rej){	//find documents from database (if you use the _id key, the search is performed by index)
			setTimeout(function(){
				db.findMany({_id: "sdasdasdas"}, ["_id", "text"]).then(res).catch(rej);
			}, 100);
		});	
	}).then(function(arr){
		//query result
		console.log(arr);
		return db.removeOne({_id: "sdasdasdas"});	//remove one document from database
	}).then(function(_id){
		console.log(_id);
		return new Promise(function(res, rej){	//find documents from database (if you use the _id key, the search is performed by index)
			setTimeout(function(){
				db.findMany({_id: "sdasdasdas"}, ["_id", "text"]).then(res).catch(rej);
			}, 100);
		});	
	}).then(function(arr){
		console.log(arr);
		return db.service.toBackup();//backup database files
	}).then(function(bool){
		console.log(bool);
		return db.service.fromBackup();//restore database files from backup
	}).then(function(bool){
		console.log(bool);
		return db.service.recovery();//recovery index file
	}).then(function(bool){
		console.log(bool);
		return db.service.compact();//index file compression
	}).then(function(){
		return db.service.compact("log");//data file compression
	}).then(function(){
		console.log('Test complete!');
	}).catch(function(err){
		console.log('Test interrupted, with error:', err);
	});
});