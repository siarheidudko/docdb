/**
 *	DocDB
 *	(c) 2019 by Siarhei Dudko.
 *  LOG-based JavaScript DataBase
 *
 */

"use strict"

var PATH = require('path'),
	FS = require('fs'),
	OBJECTSTREAM = require('@sergdudko/objectstream'),
	STREAM = require('stream'),
	ZLIB = require('zlib');
	
let DataStore = function(config){
	let self = this;
	//начальная конфигурация
	self.starttime = process.hrtime.bigint();
	self.config = new Object();
	self.config.dbname = 'docdb';												//директория с файлами данных СУБД
	self.config.dir = __dirname;												//родительская директория для self.config.dbname
	
	//настройки пользователя
	if(typeof(config) === 'object'){
		if((typeof(config.dbname) === 'string') && (config.dbname.match(/[^A-Za-z0-9]/) === null)){
			self.config.dbname = config.dbname;
		}
		if(typeof(config.dir) === 'string'){
			self.config.dir = config.dir;
		}
	}
	
	//режимы
	self.mode = new Object({
		compact: false, 														//режим сжатия файла данных СУБД (лог-файл)
		compact_id: false, 														//режим сжатия файла данных СУБД (первичный ключ)
		backup: false, 															//режим резервного копирования файлов данных СУБД
		revert: false,  														//режим отката из бэкапа файлов данных СУБД
		recovery: false															//режим восстановления СУБД
	});
	
	//пути к файлам данных
	self.pathes = new Object({
		dir: PATH.normalize(self.config.dir +'/'+ self.config.dbname),									//директория с файлами СУБД
		data: PATH.normalize(self.config.dir +'/'+ self.config.dbname +'/'+ 'data.store'),				//файл данных СУБД (лог-файл)
		dataold: PATH.normalize(self.config.dir +'/'+ self.config.dbname +'/'+ 'data.store.back'),		//бэкап файла данных СУБД (лог-файл)
		keys: new Object({																				//файлы данных СУБД (индексы)
			_id: PATH.normalize(self.config.dir +'/'+ self.config.dbname +'/'+ '_id.key')				//файл данных СУБД (первичный ключ)
		}),
		keysold: new Object({																			//бэкапы файла данных СУБД (индексы)
			_id: PATH.normalize(self.config.dir +'/'+ self.config.dbname +'/'+ '_id.key.back')			//бэкап файла данных СУБД (первичный ключ)
		})
	});
	
	//методы работы с СУБД
	self.methods = new Object({
		performance_now: function(){																	//эмуляция performance.now()
			const nexttime = process.hrtime.bigint();
			const my = [parseInt(((nexttime - self.starttime) / 1000000000n).toLocaleString()), parseInt(((nexttime - self.starttime) % 1000000000n).toLocaleString())];
			return parseFloat(my[0]+"."+my[1]);
		},
		uuidv4: function() { 																			//генерация uuid версии 4
			let d = new Date().getTime();
			d += self.methods.performance_now(); 
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				let r = (d + Math.random() * 16) % 16 | 0;
				d = Math.floor(d / 16);
				return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
			});
		}
	});
	
	//подключаю библиотеку потоковой обработки JSON (object->string и string->object)
	self.objectStream = OBJECTSTREAM;
	
	//потоки СУБД
	self.streams = new Object();
	self.streams.write = new Object();
	self.streams.transform = new Object();
	
	//поток уведомлений СУБД
	self.streams.warn = new STREAM.Readable({
		read(size){},
		highWaterMark: 64*1024,
		objectMode: true
	});
	self.streams.warn.on('error', console.error);
	
	//создание директории с файлами данных СУБД
	self.methods.mkDir = function(){
		return new Promise(function(rs, rj){
			FS.mkdir(self.pathes.dir, { recursive: true }, function(err){
				if(err){ return rj(err); }
				return rs(self.pathes.dir);
			});
		});
	}
	
	//получить байтовый размер файла данных СУБД (лог-файл)
	self.methods.getFirstByte = function(withError = true){
		return new Promise(function(rs, rj){
			FS.stat(self.pathes.data, {bigint:false}, function(err, _stat){
				if(err) {
					if(err.code === 'ENOENT'){
						self.firstByte = 0;										//если файл не найден задаю первый байт как 0
						return rs(self.firstByte);
					} else if(withError !== true){
						self.firstByte = 0;										//если отключена обработка ошибок, задаю первый байт как 0
						return rs(self.firstByte);
					} else{														//если обработка ошибок включена. возвращаю ошибку
						return rj(err);
					}
				}
				if(Number.isInteger(_stat.size) && _stat.isFile()){
					self.firstByte = _stat.size;								//возвращаю реальный размер файла в байтах
					return rs(_stat.size);
				} else {
					if(withError !== true){										//если отключена обработка ошибок, задаю первый байт как 0
						self.firstByte = 0;
						return rs(self.firstByte);
					} else {
						return rj(new Error('Unhandled exception!'));			//возвращаю эксепшн
					}
				}
			});
		});
	}
	
	//создать поток записи файла данных СУБД (первичный ключ)
	self.methods.createFirstKeyStream = function(flag = 'a'){
		return new Promise(function(rs, rj){
			self.streams.write['_id.key'] = FS.createWriteStream(self.pathes.keys['_id'], {											//поток записи файла данных СУБД (первичный ключ)
				flags:flag, 
				mode:'0600', 
				highWaterMark: 64*1024
			});
			self.streams.write['_id.key'].on('error', function(err){
				self.streams.warn.push({emitter: 'db.methods.createFirstKeyStream', err: err});
			});
			self.streams.transform['_id.key'] = new self.objectStream.Stringifer();													//поток трансформации объект->строка (первичный ключ)
			self.streams.transform['_id.key'].on('error', function(err){
				self.streams.warn.push({emitter: 'db.methods.createFirstKeyStream', err: err});
			});
			self.streams.transform['_id.key.next'] = new STREAM.Transform({															//поток трансформации строка->сжатая строка (первичный ключ)
				transform(string, encoding, callback) {
					let selfstream = this;
					ZLIB.gzip(string, function(err, buffer){
						if(err){
							return callback(err);
						}
						selfstream.push(buffer);
						return callback();
					});					
				},
				highWaterMark: 64*1024,
				objectMode: false
			});
			self.streams.transform['_id.key.next'].on('error', function(err){
				self.streams.warn.push({emitter: 'self.methods.createFirstKeyStream', err: err});
			});
			self.streams.transform['_id.key'].pipe(self.streams.transform['_id.key.next']).pipe(self.streams.write['_id.key']);		//объединение потоков (первичный ключ) [трансформация объект->строка]->[трансформация строка->сжатая строка]->[запись файла данных]
			setTimeout(rs, 100, self.streams.transform['_id.key']);
		});
	}
	
	//создать поток записи файла данных СУБД (лог-файл)
	self.methods.createDataStream = function(flag = 'a'){
		return new Promise(function(rs, rj){
			let promise = new Promise(function(rs1, rj1){																			//при пересоздании потока обновляю первый байт
				if(flag === 'a'){
					self.methods.getFirstByte(false).then(rs1).catch(rj1);
				} else {
					self.firstByte = 0;
					rs1(self.firstByte);
				}
			});
			promise.then(function(bool){
				self.streams.write['data.store'] = FS.createWriteStream(self.pathes.data, {											//поток записи файла данных СУБД (лог файл)
					flags:flag, 
					mode:'0600', 
					highWaterMark: 64*1024
				});
				self.streams.write['data.store'].on('error', function(err){
					self.streams.warn.push({emitter: 'db.methods.createDataStream', err: err});
				});
				self.streams.transform['data.store'] = new STREAM.Transform({														//поток трансформации объект->сжатая строка  (лог файл)
					transform(object, encoding, callback) {
						let selfstream = this;
						try{
							if(typeof(object) === 'object'){
								let _id = object._id;
								let string = JSON.stringify(object);																//трансформация объект->строка
								ZLIB.gzip(string, function(err, buffer){															//трансформация, сжатие
									if(err){
										return callback(err);
									}
									let _byteLength = Buffer.byteLength(buffer, 'utf8');																//измеряю байтовую длинну сжатой строки
									selfstream.push(buffer);																							//передаю сжатую строку дальше
									self.streams.transform['_id.key'].write({_id: _id, start: self.firstByte, end: self.firstByte + _byteLength});		//записываю в первичный ключ байты начала и конца объекта
									self.firstByte = self.firstByte + _byteLength;																		//меняю первый байт для следующей записи
									return callback();
								});
							} else {
								return callback();
							}
						} catch(err){
							return callback(err);
						}
					},
					highWaterMark: 64*1024,
					objectMode: true
				});
				self.streams.transform['data.store'].on('error', function(err){
					self.streams.warn.push({emitter: 'db.methods.createDataStream', err: err});
				});
				self.streams.transform['data.store'].pipe(self.streams.write['data.store']);										//объединение потоков (лог файл) [трансформация объект->сжатая строка]->[запись файла данных]
				setTimeout(rs, 100, self.streams.transform['data.store']);
			}).catch(rj);
		});
	}
	
	//создать потоки записи файлов данных СУБД (лог-файл + первичный ключ)
	self.methods.createWriteStream = function(flag = 'a'){
		return new Promise(function(rs, rj){
			self.methods.createFirstKeyStream(flag).then(function(){				//создаю поток записи файла данных СУБД (первичный ключ)
				return self.methods.createDataStream(flag);							//создаю поток записи файла данных СУБД (лог-файл)
			}).then(rs).catch(rj);
		});
	}
		
	//удалить поток записи файла данных СУБД (первичный ключ)
	self.methods.removeFirstKeyStream = function(){
		return new Promise(function(rs, rj){
			if((self.streams.transform['_id.key.next'] instanceof STREAM.Transform) && (typeof(self.streams.transform['_id.key.next'].unpipe) === 'function')){
				self.streams.transform['_id.key.next'].unpipe(self.streams.write['_id.key']);						//отвязываю поток трасформации строка->сжатая строка, от потока записи файла данных СУБД (первичный ключ)
			}
			if(self.streams.transform['_id.key'] instanceof STREAM.Transform){
				if(typeof(self.streams.transform['_id.key'].unpipe) === 'function'){
					self.streams.transform['_id.key'].unpipe(self.streams.transform['_id.key.next']);				//отвязываю поток трасформации объект->строка, от потока трасформации строка->сжатая строка
				}
				if(typeof(self.streams.transform['_id.key'].destroy) === 'function'){
					self.streams.transform['_id.key'].destroy();													//уничтожаю поток трасформации объект->строка
				}
			}
			if((self.streams.transform['_id.key.next'] instanceof STREAM.Transform) && (typeof(self.streams.transform['_id.key.next'].destroy) === 'function')){
				self.streams.transform['_id.key.next'].destroy();													//уничтожаю поток трасформации строка->сжатая строка
			}
			if((self.streams.write['_id.key'] instanceof STREAM.Writable) && (typeof(self.streams.write['_id.key'].destroy) === 'function')){
				self.streams.write['_id.key'].destroy();															//уничтожаю поток записи файла данных СУБД (первичный ключ)
			}
			setTimeout(rs, 100, true);
		});
	}
	
	//удалить поток записи файла данных СУБД (лог-файл)
	self.methods.removeDataStream = function(){
		return new Promise(function(rs, rj){
			if(self.streams.transform['data.store'] instanceof STREAM.Transform){
				if(typeof(self.streams.transform['data.store'].unpipe) === 'function'){
					self.streams.transform['data.store'].unpipe(self.streams.write['data.store']);					//отвязываю поток трасформации объект->сжатая строка, от потока записи файла данных СУБД (лог-файл)
				}
				if(typeof(self.streams.transform['data.store'].destroy) === 'function'){
					self.streams.transform['data.store'].destroy();													//уничтожаю поток трасформации объект->сжатая строка
				}
			}
			if((self.streams.write['data.store'] instanceof STREAM.Writable) && (typeof(self.streams.write['data.store'].destroy) === 'function')){
				self.streams.write['data.store'].destroy();															//уничтожаю поток записи файла данных СУБД (лог-файл)
			}
			setTimeout(rs, 100, true);
		});
	}
	
	//удалить потоки записи файлов данных СУБД (лог-файл + первичный ключ)
	self.methods.removeAll = function(){
		return new Promise(function(rs, rj){
			self.methods.removeDataStream().then(function(d){				//уничтожаю поток записи файла данных СУБД (лог-файл)
				return self.methods.removeFirstKeyStream();					//уничтожаю поток записи файла данных СУБД (первичный ключ)
			}).then(rs).catch(rj);
		});
	}
	
	//удалить файлы данных СУБД
	self.methods.removeFiles = function(files = []){
		return new Promise(function(rs, rj){
			let arr = [];
			function removeFile(file){
				return new Promise(function(rs1, rj1){
					FS.unlink(file, function(err){
						if (err) {
							if(err.code !== 'ENOENT'){						//если файла не существует, считаю что он удален
								return rj1(err);
							}
						}
						return rs1(file);
					});
				});
			}
			for(let i = 0; i < files.length; i++){
				arr.push(removeFile(files[i]));
			}
			Promise.all(arr).then(function(d){
				setTimeout(rs, 100, d);
			}).catch(function(err){
				setTimeout(function(){
					rj(err);
				}, 100);
			});
		});
	}
	
	//копировать файлы данных СУБД (в/из бэкапа)
	self.methods.copyFiles = function(files = [], frombackup = false){
		return new Promise(function(rs, rj){
			let arr = [];
			function copyFile(file, newfile){
				return new Promise(function(rs1, rj1){
					FS.copyFile(file, newfile, function(err){
						if (err) {
							return rj1(err);
						}
						return rs1(file);
					});
				});
			}
			for(let i = 0; i < files.length; i++){
				let file, newfile;
				if(frombackup){
					file = files[i];
					newfile = files[i].replace('.back', '');
				} else {
					file = files[i];
					newfile = files[i]+'.back';
				}
				arr.push(copyFile(file, newfile));
			}
			Promise.all(arr).then(function(d){
				setTimeout(rs, 100, d);
			}).catch(function(err){
				setTimeout(function(){
					rj(err);
				}, 100);
			});
		});
	}
	
	//создать резервную копию файлов данных СУБД
	self.methods.backup = function(flag = 'all'){
		self.mode.backup = true;																						//включаю режим бэкапа
		return new Promise(function(rs, rj){
			switch(flag){
				case 'all':
					self.methods.removeAll().then(function(){															//разрываю потоки записи (все, для сохранения консистентности файла данных первичного ключа и лог-файла) файлов данных СУБД (первичный ключ + лог-файл)
						return self.methods.removeFiles([self.pathes.dataold, self.pathes.keysold['_id']]);				//удаляю старые бэкапы файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						return self.methods.copyFiles([self.pathes.data, self.pathes.keys['_id']]);						//создаю новые бэкапы файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						return self.methods.createWriteStream();														//восстанавливаю потоки записи файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						setTimeout(function(){
							rs(true);
						}, 1);
					}).catch(function(err){
						setTimeout(function(){
							rj(err);
						}, 1);
					}).finally(function(){
						self.mode.backup = false;																		//отключаю режим бэкапа
					});
					break;
				case 'data':
					self.methods.removeAll().then(function(){															//разрываю потоки записи (все, для сохранения консистентности файла данных первичного ключа и лог-файла) файлов данных СУБД (первичный ключ + лог-файл)
						return self.methods.removeFiles([self.pathes.dataold]);											//удаляю старые бэкапы файлов данных СУБД (лог-файл)
					}).then(function(){
						return self.methods.copyFiles([self.pathes.data]);												//создаю новые бэкапы файлов данных СУБД (лог-файл)
					}).then(function(){
						return self.methods.createWriteStream();														//восстанавливаю потоки записи файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						setTimeout(function(){
							rs(true);
						}, 1);
					}).catch(function(err){
						setTimeout(function(){
							rj(err);
						}, 1);
					}).finally(function(){
						self.mode.backup = false;																		//отключаю режим бэкапа
					});
					break;
				case '_id':
					self.methods.removeAll().then(function(){															//разрываю потоки записи (все, для сохранения консистентности файла данных первичного ключа и лог-файла) файлов данных СУБД (первичный ключ + лог-файл)
						return self.methods.removeFiles([self.pathes.keysold['_id']]);									//удаляю старые бэкапы файлов данных СУБД (первичный ключ)
					}).then(function(){
						return self.methods.copyFiles([self.pathes.keys['_id']]);										//создаю новые бэкапы файлов данных СУБД (первичный ключ)
					}).then(function(){
						return self.methods.createWriteStream();														//восстанавливаю потоки записи файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						setTimeout(function(){
							rs(true);
						}, 1);
					}).catch(function(err){
						setTimeout(function(){
							rj(err);
						}, 1);
					}).finally(function(){
						self.mode.backup = false;																		//отключаю режим бэкапа
					});
					break;
			}
		});
	}
	
	//вернуться к резервной копии файлов данных СУБД
	self.methods.revert = function(flag = 'all'){
		self.mode.revert = true;																						//включаю режим восстановления из бэкапа
		return new Promise(function(rs, rj){
			switch(flag){
				case 'all':
					self.methods.removeAll().then(function(){															//разрываю потоки записи (все, для сохранения консистентности файла данных первичного ключа и лог-файла) файлов данных СУБД (первичный ключ + лог-файл)
						return self.methods.removeFiles([self.pathes.data, self.pathes.keys['_id']]);					//удаляю файлы данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						return self.methods.copyFiles([self.pathes.dataold, self.pathes.keysold['_id']], true);			//восстанавливаю из бэкапа файлы данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						return self.methods.createWriteStream();														//восстанавливаю потоки записи файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						setTimeout(function(){
							rs(true);
						}, 1);
					}).catch(function(err){
						setTimeout(function(){
							rj(err);
						}, 1);
					}).finally(function(){
						self.mode.revert = false;
					});
					break;
				case 'data':
					self.methods.removeAll().then(function(){															//разрываю потоки записи (все, для сохранения консистентности файла данных первичного ключа и лог-файла) файлов данных СУБД (первичный ключ + лог-файл)
						return self.methods.removeFiles([self.pathes.data]);											//удаляю файлы данных СУБД (лог-файл)
					}).then(function(){
						return self.methods.copyFiles([self.pathes.dataold]);											//восстанавливаю из бэкапа файлы данных СУБД (лог-файл)
					}).then(function(){
						return self.methods.createWriteStream();														//восстанавливаю потоки записи файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						setTimeout(function(){
							rs(true);
						}, 1);
					}).catch(function(err){
						setTimeout(function(){
							rj(err);
						}, 1);
					}).finally(function(){
						self.mode.revert = false;
					});
					break;
				case '_id':
					self.methods.removeAll().then(function(){															//разрываю потоки (все, для сохранения консистентности файла данных первичного ключа и лог-файла) записи файлов данных СУБД (первичный ключ + лог-файл)
						return self.methods.removeFiles([self.pathes.keys['_id']]);										//удаляю файлы данных СУБД (первичный ключ)
					}).then(function(){
						return self.methods.copyFiles([self.pathes.keysold['_id']]);									//восстанавливаю из бэкапа файлы данных СУБД (первичный ключ)
					}).then(function(){
						return self.methods.createWriteStream();														//восстанавливаю потоки записи файлов данных СУБД (первичный ключ + лог-файл)
					}).then(function(){
						setTimeout(function(){
							rs(true);
						}, 1);
					}).catch(function(err){
						setTimeout(function(){
							rj(err);
						}, 1);
					}).finally(function(){
						self.mode.revert = false;																		//отключаю режим восстановления из бэкапа
					});
					break;
			}
		});
	}

	//создать поток чтения файлов данных СУБД
	self.methods.createReadStream = function(fname, parts){
		return new Promise(function(rs, rj){
			let scanStream; 																														//поток чтения файла данных
			if((typeof(parts) === 'object') && Number.isInteger(parts.start) && Number.isInteger(parts.end)){
				scanStream = FS.createReadStream(fname, {flags:'r', mode:'0600', highWaterMark: 64*1024, start:parts.start, end:parts.end-1});
			} else {
				scanStream = FS.createReadStream(fname, {flags:'r', mode:'0600', highWaterMark: 64*1024});
			}
			let scanParser = new self.objectStream.Parser();																						//поток трансформации строка->объект с игнорированием ошибок
			let decompressor = new ZLIB.createGunzip({highWaterMark: 64*1024});																		//поток трансформации сжатая строка->строка
			decompressor.on('error', function(err){ 																								//ручная обработка потока трансформации сжатая строка->строка (pipe не подходит, т.к. при ошибке в любом из потоков трубопровод развалится)
//................................игнорирую ошибки декомпрессии
				decompressor.end();
				scanParser.destroy(err);
				return;
			}).on('data', function(buffer){
				return scanParser.write(buffer);																									//при получении буффера данных передаю его в поток транформации строка->объект
			}).on('end', function(buffer){
				return scanParser.end(buffer);																										//при достижении конца потока закрываю поток транформации строка->объект
			}).on('finish', function(){
				if((scanParser._readableState.ended !== true) || (scanParser._writableState.ended !== true)){										//иногда не испускается событие end
					return scanParser.end();
				}
				return;
			});
			
			scanStream.on('error', function(err){																									//ручная обработка потока чтения файла данных (можно и через pipe)
				scanStream.close();																													//при ошибке в потоке уничтожаю поток трансформации сжатая строка->строка и закрываю поток чтения файла данных
				return decompressor.destroy(err);
			}).on('data', function(buffer){
				return decompressor.write(buffer);																									//при получении буффера данных передаю его в поток транформации сжатая строка->строка
			}).on('end', function(buffer){
				return decompressor.end(buffer);																									//при достижении конца потока закрываю поток транформации сжатая строка->строка
			}).on('close', function(){
				if((decompressor._readableState.ended !== true) || (decompressor._writableState.ended !== true)){									//иногда не испускается событие end
					decompressor.end();
				//	return setTimeout(function(){
				//		if((scanParser._readableState.ended !== true) || (scanParser._writableState.ended !== true)){
				//			return scanParser.end();
				//		}
				//		return;
				//	}, 100);
				}
				return;
			});
			scanParser.on('error', function(err){ 																									//ручная обработка потока трансформации строка->объект (pipe не подходит, т.к. при ошибке в любом из потоков трубопровод развалится)
				if(err.errno !== -5){	//ошибку "недопустимый конец файла" игнорирую, т.к. поток записи "по-умолчанию" не закрыт
					self.streams.warn.push({emitter: 'db.methods.createReadStream', err: err});															//игнорирую ошибки, отправляя их в поток уведомлений
				}
			});
			rs(scanParser);
		});
	}
	
	//восстановить файлы данных СУБД
	self.methods.recovery = function(){
		self.mode.recovery = true;																			//включаю режим восстановления
		return new Promise(function(rs, rj){
			self.methods.removeAll().then(function(){														//удаляю потоки записи файлов данных СУБД (первичного ключ и лог-файл)
				return self.methods.removeFiles([self.pathes.data+'.tmp']);									//удаляю временную копию файла данных СУБД (лог-файл										
			}).then(function(){
				return new Promise(function(rs1, rj1){
					FS.copyFile(self.pathes.data, self.pathes.data+'.tmp', function(err){					//копирую файл данных СУБД (лог-файл) во временную копию файла данных СУБД (лог-файл)
						if (err) {
							return rj1(err);
						}
						return rs1();
					});
				});
			}).then(function(){
				return self.methods.createWriteStream('w');													//восстанавливаю потоки записи (с перезаписью) файлов данных СУБД (первичного ключ и лог-файл)
			}).then(function(){
				return new Promise(function(rs1, rj1){
					self.methods.createReadStream(self.pathes.data+'.tmp').then(function(rstream){			//создаю поток чтения временной копии файла данных СУБД (лог-файл)
						rstream.on('data', function(data){
							if(typeof(data) === 'object')
								self.streams.transform['data.store'].write(data);							//пишу данные из потока чтения в поток записи файлов данных СУБД (первичного ключ и лог-файл)
						}).on('finish', function(){
							self.streams.write['data.store'].on('finish', function(){
								self.methods.removeAll().then(function(){
									return self.methods.createWriteStream();
								}).then(rs1).catch(rj1);
							});
							self.streams.transform['data.store'].end();
						});
					}).catch(rj1);
				});
			}).then(function(){
				return self.methods.removeFiles([self.pathes.data+'.tmp']);									//удаляю временную копию файла данных СУБД (лог-файл
			}).then(function(){
				setTimeout(function(){
					rs(true);
				}, 100);
			}).catch(function(err){
				setTimeout(function(){
					rj(err);
				}, 100);
			}).finally(function(){
				self.mode.recovery = false;																	//отключаю режим восстановления
			});
		});
	}
	
	//поиск документа в СУБД
	self.methods.findOne = function(object, fields, parts, frombackup){
		return new Promise(function(rs1, rj1){
			if((typeof(object) === 'object') && (!Array.isArray(object))){
				let _result = {};
				let fname;
				if(frombackup){																				//поток чтения файла данных СУБД (лог файл), в зависимости от переданных байтовых координат
					fname = self.pathes.dataold;
				} else {
					fname = self.pathes.data;
				}
				self.methods.createReadStream(fname, parts).then(function(rstream){							//создаю поток чтения файла данных СУБД (лог-файл) согласно переданным пределам
					rstream.on('data', function(data){														//ручная обработка потока трансформации строка->объект (pipe не подходит, т.к. при ошибке в любом из потоков трубопровод развалится)
						if(typeof(data) === 'object'){
							let _flag = true;
							for(const key in object){														//сверяю ключи объекта с искомым
								if(object[key] !== data[key]){
									_flag = false;
									break;
								}
							}
							if(_flag){
								if(Array.isArray(fields) && (fields.length > 0)){							//передаю в результат только искомые поля
									for(const key in data){
										if((fields.indexOf(key) !== -1) || (key === '_id')){
											if(typeof(_result[data._id]) !== 'object')
												_result[data._id] = {};
											_result[data._id][key] = data[key];
										}
									}
								} else {
									_result[data._id] = data;
								}							
							}
						}
					}).on('end', function(data){
						if(typeof(data) === 'object'){
							let _flag = true;
							for(const key in object){														//сверяю ключи объекта с искомым
								if(object[key] !== data[key]){
									_flag = false;
									break;
								}
							}
							if(_flag){
								if(Array.isArray(fields) && (fields.length > 0)){							//передаю в результат только искомые поля
									for(const key in data){
										if((fields.indexOf(key) !== -1) || (key === '_id')){
											if(typeof(_result[data._id]) !== 'object')
												_result[data._id] = {};
											_result[data._id][key] = data[key];
										}
									}
								} else {
									_result[data._id] = data;
								}							
							}
						}
						let _arr = [];
						for(const _id in _result){
							if(Object.keys(_result[_id]).length > 1){	//если длинна поля = 1, т.е. док удален
								_arr.push(_result[_id]);
							}
						}
						rs1(_arr);
					});
				}).catch(rj1);
			} else {
				rj1(new Error('Function findOne require object, example {_id: "test"}'));
			}
		});
	}
	
	//запись объекта в СУБД
	self.methods.insertOne = function(object){
		return new Promise(function(rs, rj){
			if(typeof(object._id) !== 'string'){
				object._id = self.methods.uuidv4();
			}
			if(typeof(object) === 'object'){
				self.streams.transform['data.store'].write(object);
				setTimeout(rs, 10, object._id);
			} else {
				setTimeout(rj, 0, new Error('Function insertOne require object!'));
			}
		});
	}
	
	//поиск документа в СУБД без использования индексов
	self.methods.findOneNoIndex = function(object, fields){
		return self.methods.findOne(object, fields, undefined, false);
	}
	
	//поиск документа в СУБД с использованием индексов
	self.methods.findOneIndex = function(object, fields){
		return new Promise(function(rs, rj){
			if((typeof(object) === 'object') && (!Array.isArray(object))){
				let _resultKey = {};
				self.methods.createReadStream(self.pathes.keys['_id']).then(function(rstream){			//создаю поток чтения файла данных СУБД (первичный ключ)
					rstream.on('data', function(data){													//ручная обработка потока трансформации строка->объект (pipe не подходит, т.к. при ошибке в любом из потоков трубопровод развалится)
						if(typeof(data) === 'object'){
							let _flag = true;
							for(const key in object){														//сверяю ключи объекта с искомым
								if(object[key] !== data[key]){
									_flag = false;
									break;
								}
							}
							if(_flag){ 
								_resultKey = data;
							}
						}
					}).on('end', function(data){
						if(typeof(data) === 'object'){
							let _flag = true;
							for(const key in object){														//сверяю ключи объекта с искомым
								if(object[key] !== data[key]){
									_flag = false;
									break;
								}
							}
							if(_flag){ 
								_resultKey = data;
							}
						}
						if(JSON.stringify(_resultKey) === '{}'){
							rs([]); 																	//документ не найден в индексе
						} else {
							self.methods.findOne({_id:_resultKey._id}, fields, {start:_resultKey.start, end:_resultKey.end}, false).then(function(docs){				//документ найден в индексе
								rs(docs);
							}).catch(function(err){
								rj(new Error('Doc not found.'));										//ошибка, т.к. в файле данных СУБД (лог файл) по байтовому адресу из файла данных СУБД (первичный ключ) не найден документ (нужно восстановить индексы)
							});
						}
					});
				}).catch(rj);
			} else {
				rj(new Error('Function findOneIndex require object, example {_id: "test"}'));
			}
		});
	}
	
	//получить все индексы СУБД в массив
	self.methods.getAllId = function(frombackup = false){
		let fname = self.pathes.keys['_id'];
		if(frombackup){ fname = self.pathes.keysold['_id']; }
		let _idObject = {};
		return new Promise(function(rs, rj){
			self.methods.createReadStream(fname).then(function(rstream){
				rstream.on('data', function(data){
					if(data._id && ((typeof(_idObject[data._id]) === 'undefined') || (_idObject[data._id].start < data.start))) {
						//добавляю в объект данные по соответствующему документу
						_idObject[data._id] = {
							_id: data._id, 
							start: data.start, 
							end: data.end
						};
					}
				}).on('end', function(){
					//преобразую в массив с сортировкой по индексу (_id)
					let _idArray = new Array();
					for(const key in _idObject){
						_idArray.push(_idObject[key]);
					}
					_idArray.sort(function(a,b){
						if(a._id > b._id)
							return a._id;
						else
							return b._id;
					});
					rs(_idArray);
				});
			}).catch(rj);
		});
	}
	
	//сжатие файла данных СУБД
	self.methods.compact = function(flag = 'log'){
		if(flag === 'log'){
			self.mode.compact = true;																			//включаю режим сжатия
			return new Promise(function(rs, rj){
				self.methods.removeAll().then(function(){														//удаляю потоки записи файлов данных СУБД (первичный ключ и лог-файл)
					return self.methods.getAllId();																//получаю все индексы в массив
				}).then(function(indexes){
					return new Promise(function(rs1,rj1){
						self.methods.backup().then(function(){													//создаю бэкап файлов данных СУБД (первичный ключ и лог-файл)
							self.methods.createWriteStream('w').then(function(){								//восстанавливаю потоки записи (с перезаписью) файла данных СУБД (первичный ключ и лог-файл)
								return new Promise(function(rs2, rj2){
									let recursiveWrite = function(i = 0){
										let index = indexes[i];
										if(i === (indexes.length -1)){
											setTimeout(rs2, 100);
										} else { 
											self.methods.findOne({_id:index._id}, undefined, {start:index.start, end:index.end}, true).then(function(doc){				//ищу документ в бэкапе файла данных СУБД по соответствующим байтовым координатам
												if((typeof(doc[0]) === 'object') && (typeof(doc[0]._id) === 'string')){
													self.streams.transform['data.store'].write(doc[0]);			//записываю документ в файл данных СУБД (первичный ключ и лог-файл)
													recursiveWrite(++i);
												} else {														//документ не найден по байтовым координатам, ищу во всем файле (медленно)
													rj2(new Error('Doc not found.'));
												}
											}).catch(function(err){												//ошибка, т.к. в файле данных СУБД (лог файл) по байтовому адресу из файла данных СУБД (первичный ключ) не найден документ (нужно восстановить индексы)
												rj2(new Error('Doc not found.'));								
											});
										}
									}
									recursiveWrite();
								});
							}).then(function(){
								rs1();
							}).catch(function(err){
								self.methods.revert().then(function(){											//восстанавливаю из бэкапа бэкапа файлы данных СУБД (первичный ключ и лог-файл)
									rj1(err);
								}).catch(rj1);
							});
						}).catch(function(err){
							self.methods.createWriteStream().then(function(){									//восстанавливаю потоки записи файлов данных СУБД (первичный ключ и лог-файл)
								rj1(err);
							}).catch(rj1);
						});
					});									
				}).then(function(){
					setTimeout(rs, 100);
				}).catch(rj).finally(function(){
					self.mode.compact = true;																	//отключаю режим сжатия
				});
			});
		} else {
			self.mode.compact_id = true;																		//включаю режим сжатия индексов
			return new Promise(function(rs, rj){
				self.methods.removeAll().then(function(){														//удаляю потоки записи файлов данных СУБД (первичный ключ и лог-файл)
					return self.methods.getAllId();																//получаю все индексы в массив
				}).then(function(indexes){
					return new Promise(function(rs1,rj1){
						self.methods.backup().then(function(){													//создаю бэкап файлов данных СУБД (первичный ключ и лог-файл)
							(new Promise(function(rs2, rj2){
								self.methods.createFirstKeyStream('w').then(function(){							//создаю поток записи (с перезаписью) файла данных СУБД (первичный ключ)
									return new Promise(function(rs3, rj3){
										for(let i = 0; i < indexes.length; i++){
											self.streams.transform['_id.key'].write(indexes[i]);
										}
										setTimeout(rs3, 3*indexes.length);
									});
								}).then(function(){
									return self.methods.removeFirstKeyStream();									//удаляю поток записи (с перезаписью) файла данных СУБД (первичный ключ)
								}).then(function(){
									rs2();
								}).catch(rj2);
							})).then(function(){
								rs1();
							}).catch(function(err){
								self.methods.revert().then(function(){											//восстанавливаю из бэкапа бэкапа файлы данных СУБД (первичный ключ и лог-файл)
									rj1(err);
								}).catch(rj1);
							});
						}).catch(function(err){
							self.methods.createWriteStream().then(function(){									//восстанавливаю потоки чтения файлов данных СУБД (первичный ключ и лог-файл)
								rj1(err);
							}).catch(rj1);
						});
					});					
				}).then(function(){
					setTimeout(rs, 100);
				}).catch(rj).finally(function(){
					self.mode.compact_id = true;																//отключаю режим сжатия индексов
				});
			});
		}
	}
	
	//инициализация СУБД
	return new Promise(function(rs, rj){
		self.methods.mkDir().then(function(){ 
			return self.methods.createWriteStream();
		}).then(function(){
			rs(self);
		}).catch(rj);
	});
}

module.exports = DataStore;