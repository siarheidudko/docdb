let PATH = require('path'),
	READLINE = require('readline'),
	DATASTORE = require(PATH.join(__dirname, 'index.js'));
	
let DataBase = new DATASTORE({dbname:'_test'});

let testdoc = require('./test.json');	//тестовый док 43338 байт

DataBase.then(function(db){
	db.streams.warn.on('data', function(buffer){
		console.log(buffer);
	});
	let help = 
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