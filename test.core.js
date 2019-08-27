let PATH = require('path'),
	READLINE = require('readline'),
	FS = require('fs'),
	STREAM = require('stream'),
	ZLIB = require('zlib'),
	COLORS = require('colors'),
	CRYPTO = require('crypto'),
	DATASTORE = require(PATH.join(__dirname, 'core.js'));
	
let DataBase = new DATASTORE({dbname:'test'});

let testdoc = require('./test.json');	//тестовый док 43338 байт

DataBase.then(function(db){
	db.streams.warn.on('data', function(buffer){
		console.log(buffer);
	});
	let tests = {
		/**
		 * performance_now
		 */
		performance_now: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function performance_now: ';
			let r = db.methods.performance_now();
			if(Number.isFinite(r)){
				dt2 = Date.now();
				console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
			} else {
				console.log(COLORS.red(str+'ERR'));
			}
			setTimeout(callback, 100);
		},
		/**
		 * uuidv4
		 */
		uuidv4: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function uuidv4: ';
			let r = db.methods.uuidv4();
			if(r.match(new RegExp(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i))){
				dt2 = Date.now();
				console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
			} else {
				console.log(COLORS.red(str+'ERR'));
			}
			setTimeout(callback, 100);
		},
		/**
		 * mkDir
		 */
		mkDir: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function mkDir: ';
			FS.stat(db.pathes.dir, function(err, stat){
				dt2 = Date.now();
				if(!err && stat.isDirectory()){
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
				setTimeout(callback, 100);
			});
		},
		/**
		 *	insert 10k docs (43338 байт *10k = 413 МБ)
		 */
		set10kDdoc: function(callback){
			let dt2, dt = Date.now();
			let str = 'Insert 10k docs (43338b*10k = 413Mb raw data): ';
			let iter = 9999;
			let recursiveWrite = function(i = 0){
				if(i < iter){
					if(parseInt(i%3) === 0)
						testdoc._id = db.methods.uuidv4();
					db.methods.insertOne(testdoc).then(function(_id){
						//
					}).catch(console.error).finally(function(){
						recursiveWrite(++i);
					});
				} else {
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
					callback();
				}
			}
			recursiveWrite();
		},
		/**
		 * getFirstByte
		 */
		getFirstByte: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function getFirstByte: ';
			if(Number.isInteger(db.firstByte)){
				dt2 = Date.now();
				console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
			} else {
				console.log(COLORS.red(str+'ERR'));
			}
			setTimeout(callback, 100);
		},
		/**
		 * removeFirstKeyStream
		 */
		removeFirstKeyStream: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function removeFirstKeyStream: ';
			db.methods.removeFirstKeyStream().then(function(){
				if((db.streams.transform['_id.key'] instanceof STREAM.Transform) && (db.streams.transform['_id.key']._readableState.destroyed === true) && (db.streams.transform['_id.key']._writableState.destroyed === true) &&
				   (db.streams.transform['_id.key.next'] instanceof STREAM.Transform) && (db.streams.transform['_id.key.next']._readableState.destroyed === true) && (db.streams.transform['_id.key.next']._writableState.destroyed === true) &&
				   (db.streams.write['_id.key'] instanceof STREAM.Writable) && (db.streams.write['_id.key'].closed === true)
				){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * createFirstKeyStream
		 */
		createFirstKeyStream: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function createFirstKeyStream: ';
			db.methods.createFirstKeyStream().then(function(){
				if((db.streams.transform['_id.key'] instanceof STREAM.Transform) && (db.streams.transform['_id.key']._readableState.destroyed === false) && (db.streams.transform['_id.key']._writableState.destroyed === false) &&
				   (db.streams.transform['_id.key.next'] instanceof STREAM.Transform) && (db.streams.transform['_id.key.next']._readableState.destroyed === false) && (db.streams.transform['_id.key.next']._writableState.destroyed === false) &&
				   (db.streams.write['_id.key'] instanceof STREAM.Writable) && (db.streams.write['_id.key'].closed === false)
				){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * removeDataStream
		 */
		removeDataStream: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function removeDataStream: ';
			db.methods.removeDataStream().then(function(){
				if((db.streams.transform['data.store'] instanceof STREAM.Transform) && (db.streams.transform['data.store']._readableState.destroyed === true) && (db.streams.transform['data.store']._writableState.destroyed === true) &&
			       (db.streams.write['data.store'] instanceof STREAM.Writable) && (db.streams.write['data.store'].closed === true)
				){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * createDataStream
		 */
		createDataStream: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function createDataStream: ';
			db.methods.createDataStream().then(function(){
				if((db.streams.transform['data.store'] instanceof STREAM.Transform) && (db.streams.transform['data.store']._readableState.destroyed === false) && (db.streams.transform['data.store']._writableState.destroyed === false) &&
			       (db.streams.write['data.store'] instanceof STREAM.Writable) && (db.streams.write['data.store'].closed === false)
				){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * removeAll
		 */
		removeAll: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function removeAll: ';
			db.methods.removeAll().then(function(){
				if((db.streams.transform['_id.key'] instanceof STREAM.Transform) && (db.streams.transform['_id.key']._readableState.destroyed === true) && (db.streams.transform['_id.key']._writableState.destroyed === true) &&
				   (db.streams.transform['_id.key.next'] instanceof STREAM.Transform) && (db.streams.transform['_id.key.next']._readableState.destroyed === true) && (db.streams.transform['_id.key.next']._writableState.destroyed === true) &&
				   (db.streams.write['_id.key'] instanceof STREAM.Writable) && (db.streams.write['_id.key'].closed === true) &&
				   (db.streams.transform['data.store'] instanceof STREAM.Transform) && (db.streams.transform['data.store']._readableState.destroyed === true) && (db.streams.transform['data.store']._writableState.destroyed === true) &&
			       (db.streams.write['data.store'] instanceof STREAM.Writable) && (db.streams.write['data.store'].closed === true)
				){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * createWriteStream
		 */
		createWriteStream: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function createWriteStream: ';
			db.methods.createWriteStream().then(function(){
				if((db.streams.transform['_id.key'] instanceof STREAM.Transform) && (db.streams.transform['_id.key']._readableState.destroyed === false) && (db.streams.transform['_id.key']._writableState.destroyed === false) &&
			       (db.streams.transform['_id.key.next'] instanceof STREAM.Transform) && (db.streams.transform['_id.key.next']._readableState.destroyed === false) && (db.streams.transform['_id.key.next']._writableState.destroyed === false) &&
				   (db.streams.write['_id.key'] instanceof STREAM.Writable) && (db.streams.write['_id.key'].closed === false) &&
			       (db.streams.transform['data.store'] instanceof STREAM.Transform) && (db.streams.transform['data.store']._readableState.destroyed === false) && (db.streams.transform['data.store']._writableState.destroyed === false) &&
			       (db.streams.write['data.store'] instanceof STREAM.Writable) && (db.streams.write['data.store'].closed === false)
				){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * copyFiles
		 */
		copyFiles: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function copyFiles: ';
			db.methods.copyFiles([db.pathes.data, db.pathes.keys['_id']]).then(function(){
				dt2 = Date.now();
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.data, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.data);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.dataold, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.dataold);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keys['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keys['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keysold['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keysold['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
			}).catch(function(err){
				if(err === ''){
					console.log(COLORS.red(str+'ERR'));
				} else {
					console.log(COLORS.red(str+err));
				};
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * removeFiles
		 */
		removeFiles: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function removeFiles: ';
			db.methods.removeFiles([db.pathes.dataold, db.pathes.keysold['_id']]).then(function(){
				dt2 = Date.now();
				FS.stat(db.pathes.dataold, function(err, stat){
					if(err && (err.code === 'ENOENT')){
						FS.stat(db.pathes.keysold['_id'], function(err, stat1){
							if(err && (err.code === 'ENOENT')){
								console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
							} else {
								console.log(COLORS.red(str+'ERR'));
							}
							setTimeout(callback, 100);
						});
					} else {
						console.log(COLORS.red(str+'ERR'));
						setTimeout(callback, 100);
					}
				});
			}).catch(function(err){
				console.log(COLORS.red(str+err));
				setTimeout(callback, 100);
			});
		},
		/**
		 * backup
		 */
		backup: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function backup: ';
			db.methods.backup().then(function(){
				dt2 = Date.now();
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.data, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.data);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.dataold, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.dataold);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keys['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keys['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keysold['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keysold['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
			}).catch(function(err){
				if(err === ''){
					console.log(COLORS.red(str+'ERR'));
				} else {
					console.log(COLORS.red(str+err));
				}
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * revert
		 */
		revert: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function revert: ';
			db.methods.revert().then(function(){
				dt2 = Date.now();
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.data, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.data);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.dataold, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.dataold);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keys['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keys['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keysold['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keysold['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
			}).catch(function(err){
				if(err === ''){
					console.log(COLORS.red(str+'ERR'));
				} else {
					console.log(COLORS.red(str+err));
				}
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * createReadStream
		 */
		createReadStream: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function createReadStream: ';
			db.methods.createReadStream(db.pathes.data).then(function(rstream){
				if((rstream instanceof STREAM.Readable) && (rstream.closed !== true)){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * recovery
		 */
		recovery: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function recovery: ';
			db.methods.recovery().then(function(){
				dt2 = Date.now();
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.data, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.data);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.dataold, function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.dataold);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keys['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keys['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								rs(hash.digest('hex'));
							});
						}
					});
				});
			}).then(function(sha256){
				return new Promise(function(rs, rj){
					FS.stat(db.pathes.keysold['_id'], function(err, stat){				
						if(err || !stat.isFile()){
							rj(err)
						} else {
							const hash = CRYPTO.createHash('sha256');
							const read = FS.createReadStream(db.pathes.keysold['_id']);
							read.on('data', function(buffer){
								hash.update(buffer);
							}).on('error', function(err){
								rj(err);
							}).on('end', function(){
								if(hash.digest('hex') === sha256){
									rs(true);
								} else {
									rj('Hash discrepancy!');
								}
							});
						}
					});
				});
			}).then(function(bool){
				console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
			}).catch(function(err){
				if(err === ''){
					console.log(COLORS.red(str+'ERR'));
				} else {
					console.log(COLORS.red(str+err));
				}
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * findOne
		 */
		findOne: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function findOne: ';
			db.methods.findOne({_id: db.methods.uuidv4()}, ["_id", "type", "guid"]).then(function(doc){
				if(JSON.stringify(doc) === '[]'){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * insertOne
		 */
		insertOne: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function insertOne (with findOne!): ';
			let doc = {_id: '8b1bc66b-7ef3-47f0-be0a-6320e1f5f40f777', guid: db.methods.uuidv4(), text: 'test', test: 'YUB8tgn*&B&n(&bt6b7n9b679nb67b&bn7Tb'};
			db.methods.insertOne(doc).then(function(_id){
				dt2 = Date.now();
				return new Promise(function(rs, rj){
					setTimeout(function(){
						db.methods.findOne({_id: _id}, ["_id", "type", "guid", "test"]).then(rs).catch(rj);
					}, 100);
				});
			}).then(function(_doc){
				if((doc._id === _doc[0]._id) && (doc.guid === _doc[0].guid) && (doc.test === _doc[0].test) && (typeof(_doc[0].text) === 'undefined')){
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * findOneNoIndex
		 */
		findOneNoIndex: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function findOneNoIndex: ';
			db.methods.findOneNoIndex({_id: '8b1bc66b-7ef3-47f0-be0a-6320e1f5f40f777', text: 'test'}, ['_id', 'test']).then(function(doc){
				if((doc[0]._id === '8b1bc66b-7ef3-47f0-be0a-6320e1f5f40f777') && (doc[0].test === 'YUB8tgn*&B&n(&bt6b7n9b679nb67b&bn7Tb')){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		},
		/**
		 * findOneIndex
		 */
		findOneIndex: function(callback){
			let dt2, dt = Date.now();
			let str = 'Test function findOneIndex: ';
			db.methods.findOneIndex({_id: '8b1bc66b-7ef3-47f0-be0a-6320e1f5f40f777'}, ['_id', 'test']).then(function(doc){
				if((doc[0]._id === '8b1bc66b-7ef3-47f0-be0a-6320e1f5f40f777') && (doc[0].test === 'YUB8tgn*&B&n(&bt6b7n9b679nb67b&bn7Tb')){
					dt2 = Date.now();
					console.log(COLORS.green(str+'ОК'), (dt2 - dt)+' ms.');
				} else {
					console.log(COLORS.red(str+'ERR'));
				}
			}).catch(function(err){
				console.log(COLORS.red(str+err));
			}).finally(function(){
				setTimeout(callback, 100);
			});
		}
	}
	
	function goTests(){
		return new Promise(function(rs, rj){
			let recursiveTests = function(i, _keys){
				if(_keys[i]){
					tests[_keys[i]](function(){
						recursiveTests(++i, _keys);
					});
				} else {
					rs();
				}
			}
			recursiveTests(0, Object.keys(tests));
		});
	}
	
	goTests().catch(function(err){
		console.log(COLORS.red(err));
	}).finally(function(){
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
});