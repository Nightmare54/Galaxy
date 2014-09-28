/** Database management Modules.
* - HerokuDatabase : pg - users,roomauth
* - https/ftp requests to get chatRoomData etc.
*/
var fs = require('fs');
var needle = require('needle');

/***************************************************
 *	Database Manager for the Heroku PSQL Database
 *  
 * functions on promote/demote (global) are in users.js : 'setGroup'
 *  TABLE : users
 *	name    : string
 *	groupid : char
 *
 * users.usergroups - format :
 *    { name:group+name }
 *  example:
 * 		'codelegend':'~codelegend'
 *****************************************************
 *
 * functions on room promote/demote are in commands.js : 'roompromote'
 * TABLE : roomauth
 *		name : string
 *		groupid : char
 *		room : string  
 * room.auth format:
 * 	     { name:group } 
*****************************************************/
var HerokuDatabase = (function() {
	
	function HerokuDatabase(){
		if(!Config.HerokuDB) return;
		this.DB_URL = process.env.DATABASE_URL;
		this.errors = [];
		try{
			this.initUserlists();
		}catch(e){ console.log('user lists not set');}
		try { this.loadNumBattles(); }
		catch(e) { console.log('last battle not loaded'); }
	}
	HerokuDatabase.prototype.dbtype = 'heroku';
	HerokuDatabase.prototype.initUserlists = function(){
		if(!Config.HerokuDB) return;
		var pgdb = require('pg');
		var self = this;
		pgdb.connect( this.DB_URL , function(err, client, done){
			if(err){
				console.log('Not connected to pgdb (userdb)'+err);
				return;
			}
			
			var userlist = client.query('SELECT * FROM USERS'),
				roomlist = client.query('SELECT * FROM ROOMAUTH');
			
			userlist.on('row',function(user){
				Users.usergroups[ toId(user.name) ] = user.groupid+toId(user.name);
			});
			roomlist.on('row', function(user){
				if( user.room === 'lobby' || user.room === 'global' || !Rooms.get(user.room) ) return;
				var room = Rooms.get(user.room);
				if (!room.auth) room.auth = {};
				room.auth[ toId(user.name) ] = user.groupid;
			});
			userlist.on('end',function(){
				roomlist.on('end',function(){
					done();
				});
			});
		});
	};
	HerokuDatabase.prototype.loadNumBattles = function(){
		if(!Config.HerokuDB) return;
		var pgdb = require('pg');
		pgdb.connect(this.DB_URL, function(err, client, done){
			if(err){
				console.log('error while writing num rooms');
				return;
			}
			var query = client.query('SELECT * FROM LASTBATTLE');
			query.on('row',function(row){
				var num = parseInt(row.num) || 1;
				if( !global.Rooms || !Rooms.global ){
					setTimeout( function(){
						Rooms.global.lastBattle = num;
					}, 20*1000);
				}
				Rooms.global.lastBattle = num;
			});
			query.on( 'end', function(){done();} );
		});
	};
	
	HerokuDatabase.prototype.UpdateUserTable = function(name,group,room){
		if(!Config.HerokuDB) return;
		/********************************************
		*	this function updates the user tables,
		* namely USERS and ROOMAUTH.
		* 
		* if (room) is passed, then ROOMAUTH is updated,
		* else USERS is updated.
		*
		* if (group) is passed , then user's group is set to that group,
		* else, user is removed from the table.
		*********************************************/
		name = toId(name); if(room) room= toId(room);
		
		var pgdb = require('pg');
		var self=this;
		pgdb.connect( this.DB_URL , function(err,client,done){
			if(err){
				console.log('User table not updated'+ err);
				return;
			}
			if(room){
				var delquery = client.query( 'DELETE FROM ROOMAUTH WHERE NAME = $1 AND ROOM = $2' ,[name,room] );
				delquery.on('end', function(){
					if(group) 
						client.query( 'INSERT INTO ROOMAUTH (NAME,GROUPID,ROOM) VALUES ($1,$2,$3)' ,[name,group,room] )
							.on('end', function(){ done(); }) ;
						else done();
				});
			} else {
				var delquery = client.query( 'DELETE FROM USERS WHERE NAME = $1' ,[name] );
				delquery.on('end', function(){
					if(group)
						client.query( 'INSERT INTO USERS (NAME,GROUPID) VALUES ($1,$2)' ,[name,group] )
							.on('end', function(){ done(); }) ;
					else done();
				});
			}
		});
	
	};
	
	HerokuDatabase.prototype.logNumBattles = function( lastBattle ){
		if(!Config.HerokuDB) return;
		var pgdb = require('pg');
		pgdb.connect(this.DB_URL, function(err, client, done){
			if(err){
				console.log('error while writing num rooms');
				return;
			}
			client.query('UPDATE LASTBATTLE SET NUM='+lastBattle)
			.on( 'end', function(){done();} );
		});
	};
	
	HerokuDatabase.prototype.makeQuery = function( querystring,output ){
		if(!Config.HerokuDB) return;
		if(!querystring) return '';
		var pgdb = require('pg');
		var self=this;
		pgdb.connect(this.DB_URL, function(err, client, done){
			if(err){
				console.log('error');
				return;
			}
			var query = client.query(querystring);
			var res = [];
			query.on('row',function(row){
				res.push(row);
			});
			query.on('end',function(row){
				if(output) output.sendReply( JSON.stringify(res) );
				done();
			});
		});
	};
	return HerokuDatabase;
})();

// dont use the following until you have set up a file abstraction layer
Rooms.GlobalRoom.prototype.readChatrooms= function(firsttime){
	var addrooms = [];
	try{
		addrooms = JSON.parse(fs.readFileSync('config/chatrooms.json'));
		if (!Array.isArray(addrooms)) addrooms = [];
	} catch(e){
		addrooms = [];
	}
	for (var i = 0; i < addrooms.length; i++) {
		if (!addrooms[i] || !addrooms[i].title) {
			console.log('ERROR: Room number ' + i + ' has no data.');
			continue;
		}
		var id = toId(addrooms[i].title);
		if( id == 'lobby' ){
			Rooms.lobby.introMessage = addrooms[i].introMessage || '';
			Rooms.lobby.desc = addrooms[i].desc || '';
		}
		if( id == 'staff'){
			Rooms.rooms.staff.introMessage = addrooms[i].introMessage || '';
			Rooms.rooms.staff.desc = addrooms[i].desc || '';
		}
		if( Rooms.rooms[id] )continue;
		this.chatRoomData.push(addrooms[i]);
		console.log("NEW CHATROOM: " + id);
		var room = Rooms.rooms[id] = new Rooms.ChatRoom(id, addrooms[i].title, addrooms[i]);
		this.chatRooms.push(room);
		if (room.autojoin) this.autojoin.push(id);
		if (room.staffAutojoin) this.staffAutojoin.push(id);
	}
	if( firsttime && DatabaseManager && DatabaseManager.Heroku ){
		DatabaseManager.Heroku.initUserlists();
	}
};

var fileStorage = (function(){
	function fileStorage(){
	 
		this.errors = [];
		this.chatreadurl = process.env.chatreadurl || '';
		this.readChatrooms();
	}
	fileStorage.prototype.dbtype = 'ftp|http';
	
	fileStorage.prototype.readChatrooms = function(output){
		if(!this.chatreadurl){
			if(output && output.sendReply) output.sendReply("NO URL SET TO READ CHATROOMS");
			console.log("NO URL SET TO READ CHATROOMS");
			return;
		}
		var url = this.chatreadurl;
		needle.get(url,function(err,resp){
			if(err){
				if(output && output.sendReply) output.sendReply('Unable to read chat rooms' + err);
				console.log('Unable to read chat rooms' + err);
				return;
			}
			fs.writeFile('config/chatrooms.json', resp.body , function(err){
				if(err){
					if(output) output.sendReply('error in loading chatrooms.json');
					console.log('error in loading chatrooms.json');
					return;
				}
				if(output && output.sendReply) output.sendReply('load success... creating rooms...');
				console.log('load success... creating rooms...');
				if(global.Rooms && Rooms.global) Rooms.global.readChatrooms(true);
			});
		});
	};
	fileStorage.prototype.writeRoomData = function(user){
		var reqOpts = {
			hostname: "hastebin.com",
			method: "POST",
			path: '/documents'
		};
		var toUpload = JSON.stringify(Rooms.global.chatRoomData).replace(/\{"title"\:/g, '\n{"title":').replace(/\]$/, '\n]');
		var http = require('http');
		var req = http.request(reqOpts, function(res) {
			res.on('data', function(chunk) {
				console.log( "hastebin.com/raw/" + JSON.parse(chunk.toString())['key'] );
				if( user && user.sendReply ) user.sendReply( "http://hastebin.com/raw/" + JSON.parse(chunk.toString())['key'] );
			});
		});
	
		req.write(toUpload);
		req.end();
		return;
	};
	
	return fileStorage;
})();


exports.Heroku = new HerokuDatabase();
exports.files = new fileStorage();
