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
	let db = new DATASTORE(config);
	self = new STREAM.Readable({
		read(size){},
		highWaterMark: 64*1024,
		objectMode: true
	});
	db.streams.warn.pipe(self);
	self.service = {
		toBackup: db.methods.backup,
		fromBackup: db.methods.revert,
		recovery: self.methods.recovery,
		compact: function(flag = 'index'){
			switch(flag){
				case 'index':
					db.methods.compact('index');
					break;
				case 'log':
					db.methods.compact('log');
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
	self.findOne = function(find, fields){
		return new Promise(function(rs,rj){
			if(typeof(find) !== 'object'){
				return rj('In this database version find required type object!');
			} else if(typeof(find._id) !== 'string'){
				db.methods.findOneNoIndex(find, fields).then(function(doc){
					rs(doc);
				}).catch(rj);
			} else {
				db.methods.findOneIndex({_id: find._id}, fields).then(function(doc){
					let flag = true;
					for(const key in find){
						if(find[key] !== doc[key]) { flag = false; break; }
					}
					if(flag){
						rs(doc);
					} else {
						rs({});
					}
				}).catch(rj);
			}
		});
	}
};

module.exports = DataBase;