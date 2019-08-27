
# DocDB

LOG-based JavaScript DataBase (based on streaming processing).
The database is currently under development, please do not use it in production. The API will be significantly changed.

## Note  
The main problem at the moment is that the recording stream should always be open (to ensure insertion performance), but in fact I can not get the document insertion event in the data file due to the complexity of the streaming architecture. 
Those. the insert operation occurs without real feedback from the recording stream.

## Install  
  
```
	npm i docdb --save
```
  

## Use
  
```
	const DATASTORE = require('docdb');
	let DataBase = new DATASTORE({dbname:'_test'});
	DataBase.then(function(db){
		
		//warning stream
		db.on('data', function(buffer){
			console.log(buffer);
		});
		
		//find documents from database (if you use the _id key, the search is performed by index)
		db.findMany({..filter documents fields type of Object}, [..document fields returned type of Array]).then(function(arr){
			//query result type of Array
			console.log(arr);
		});
		
		//insert (or update if exists) one document from database
		db.insertOne({..insert document type of Object}).then(function(_id){
			console.log(arr);
		});
		
		//remove one document from database
		db.removeOne({_id: first key document type of String}).then(function(_id){
			console.log(arr);
		});
		
		//backup database files
		db.service.toBackup().then(function(){
		
		});
		
		//restore database files from backup
		db.service.fromBackup().then(function(){
			
		});
		
		//recovery index file
		db.service.recovery().then(function(){
			
		});
		
		//index file compression
		db.service.compact().then(function(){
			
		});
		
		//data file compression
		db.service.compact("log").then(function(){
			
		});
	});
```

## EXAMPLE

```
	const DATASTORE = require('docdb');
	let DataBase = new DATASTORE({dbname:'test'});
	DataBase.then(function(db){
		
		//warning stream
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
```

## EXAMPLE CONSOLE  
```
	let READLINE = require('readline'),
		DATASTORE = require('docdb');
		
	let DataBase = new DATASTORE({dbname:'test'});

	DataBase.then(function(db){
		db.on('data', function(buffer){
			console.log(buffer);
		});
		const rl = READLINE.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: 'DocDB> '
		});
		rl.prompt();
		rl.on('line', (line) => {
			try{
				let _tmp = eval(line);
				if(typeof(_tmp) !== 'undefined'){
					console.log(_tmp);
				}
			} catch(err) {
				console.error("Ошибка команды: "+err);
			}
			rl.prompt();
		}).on('close', () => {
			console.log('DocDB disconnected!');
			process.exit(0);
		});
	});
```
  
## LICENSE  
  
Apache-2.0  
