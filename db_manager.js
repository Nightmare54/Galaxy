/** Database management Modules.
* - HerokuDatabase : pg - users,roomauth
* - https/ftp requests to get chatRoomData etc.
*/
var fs = require('fs');
var needle = require('needle');
/***************************************************
* Database Manager for the Heroku PSQL Database
*
* functions on promote/demote (global) are in users.js : 'setGroup'
* TABLE : users
* name : string
* groupid : char
*
* users.usergroups - format :
* { name:group+name }
* example:
* 'codelegend':'~codelegend'
*****************************************************
*
* functions on room promote/demote are in commands.js : 'roompromote'
* TABLE : roomauth
* name : string
* groupid : char
* room : string
* room.auth format:
* { name:group }
*****************************************************/
var HerokuDatabase = (function() {
function HerokuDatabase(){
if(!Config.HerokuDB) return;
this.DB_URL = process.env.DATABASE_URL;
this.errors = [];
try{
this.initUserlists();
}catch(e){ console.log('user lists not set');}
}
HerokuDatabase.prototype.dbtype = 'heroku';
HerokuDatabase.prototype.initUserlists = function(){
if(!Config.HerokuDB) return;
var pgdb = require('pg');
var self = this;
pgdb.connect( this.DB_URL , function(err, client, done){
if(err){
console.log(err);
self.errors.push('Error loading Heroku PSQL database. check logs for details');
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
}
HerokuDatabase.prototype.UpdateUserTable = function(name,group,room){
if(!Config.HerokuDB) return;
/********************************************
* this function updates the user tables,
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
console.log(err);
self.errors.push('error in addUser, unable to connect to database');
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
HerokuDatabase.prototype.makeQuery = function( querystring,output ){
if(!Config.HerokuDB) return;
if(!querystring) return '';
var pgdb = require('pg');
var self=this;
pgdb.connect(this.DB_URL, function(err, client, done){
if(err){
self.errors.push('error in connecting to db');
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
var fileStorage = (function(){
function fileStorage(){
this.errors = [];
this.chatdataurl = (process.env.dataurl)?(process.env.dataurl+'/chatroomedit.php'):'';
this.readChatrooms();
}
fileStorage.prototype.dbtype = 'ftp|http';
fileStorage.prototype.readChatrooms = function(output){
if(!this.chatdataurl){
console.log("NO URL SET TO READ CHATROOMS");
return;
}
var url = this.chatdataurl;
needle.get(url,function(err,resp){
if(err){
console.log(err);
return;
}
fs.writeFile('config/chatrooms.json', resp.body , function(err){
if(err){
if(output) output.sendReply('error in loading chatrooms.json');
console.log('error in loading chatrooms.json');
return;
}
if(output) output.sendReply('load success... creating rooms...');
console.log('load success... creating rooms...');
if(Rooms && Rooms.global) Rooms.global.readChatrooms(true);
});
});
};
fileStorage.prototype.writeRoomData = function(output){
if( Config.NoWriteChatData ) return false;
var chatdata = JSON.stringify(Rooms.global.chatRoomData).replace(/\{"title"\:/g, '\n{"title":').replace(/\]$/, '\n]');
var data = {
user: process.env.requser|| '',
pass: process.env.reqpass || '',
chatroomfile: chatdata
}
if(!this.chatdataurl){
console.log('no request url set for chatrooms ' );
return false;
}
var url = this.chatdataurl;
needle.post(url, data, function(err, resp, body) {
if(err){
console.error(err);
if( output && output.sendReply ) output.sendReply('error in uploading chatrooms.json . check logs');
return;
}
// console.log('chatrooms : update success'+body);
if( output && output.sendReply ) output.sendReply(body);
});
return;
};
fileStorage.prototype.readCustomCommands = function(userout,cmdurl){
if(!cmdurl) return;
var stream = needle.get(cmdurl), data = '', file;
stream.on('error', function(){ console.log('error while downloading ccommands.js');});
stream.on('readable', function () {
var chunk;
while (chunk = this.read()) {
data +=chunk;
}
});
stream.on('end', function(){
fs.writeFile('chat-plugins/customcommands.js', data, function(err){
if(err){
console.error('unable to write file ccommands');
return;
}
try {
// uncache the customcommands.js dependency tree
CommandParser.uncacheTree('./chat-plugins/customcommands.js');
// reload commands
CommandParser.uncacheTree('./command-parser.js');
CommandParser = require('./command-parser.js');
var runningTournaments = Tournaments.tournaments;
CommandParser.uncacheTree('./tournaments');
Tournaments = require('./tournaments');
Tournaments.tournaments = runningTournaments;
console.log('custom commands loaded...');
} catch (e) {
if(userout) userout.sendReply("Something failed while trying to hotpatch customcommands: \n" + e.stack);
console.log("Something failed while trying to hotpatch customcommands");
return;
}
});
});
};
return fileStorage;
})();
exports.Heroku = new HerokuDatabase();
exports.files = new fileStorage();
// write the data every 30 minutes.
var updaterooms = setInterval( function(){
exports.files.writeRoomData();
} , 1000 * 60 * 30 );
if( process.env.dataurl) exports.files.readCustomCommands(null, process.env.dataurl+'/ccommands.js');