/**
 *	DocDB
 *	(c) 2019 by Siarhei Dudko.
 *  LOG-based JavaScript DataBase
 *
 */

"use strict"

var PATH = require('path'),
	STREAM = require('stream'),
	DATASTORE = require(PATH.join(__dirname, 'core.js'));

let DataBase = function(config){
	let self = this;
	return new DATASTORE(config).then(function(db){
		return new Promise(function(res, rej){
			self = new STREAM.Readable({
				read(size){},
				highWaterMark: 64*1024,
				objectMode: true
			});
			db.streams.warn.pipe(self);
			self.service = {
				toBackup: db.methods.backup,
				fromBackup: db.methods.revert,
				recovery: db.methods.recovery,
				compact: function(flag = 'index'){
					switch(flag){
						case 'index':
							return db.methods.compact('index');
							break;
						case 'log':
							return db.methods.compact('log');
							break;
						default:
							return new Promise(function(rs, rj){
								rj(new Error('Compact required argument index or log!'));
							});
							break;
					}
				}
			};
			self.insertOne = db.methods.insertOne;
			self.removeOne = function(doc){
				return new Promise(function(rs, rj){
					if(doc._id){
						db.methods.insertOne({_id: doc._id}).then(rs).catch(rj);
					} else{
						rj(new Error('Function removeOne required _id!'));
					}
				});
			};
			self.findMany = function(find, fields){
				return new Promise(function(rs,rj){
					if(typeof(find) !== 'object'){
						return rj('In this database version find required type object!');
					} else if(typeof(find._id) !== 'string'){
						db.methods.findOneNoIndex(find, fields).then(function(docs){
							rs(docs);
						}).catch(rj);
					} else {
						db.methods.findOneIndex({_id: find._id}, fields).then(function(docs){
							let _docs = [];
							for(let i = 0; i < docs.length; i++){
								let flag = true;
								for(const key in find){
									if(find[key] !== docs[i][key]) { flag = false; break; }
								}
								if(flag){
									_docs.push(docs[i]);
								}
							}
							return rs(_docs);
						}).catch(rj);
					}
				});
			}
			res(self);
		});
	});
};

module.exports = DataBase;