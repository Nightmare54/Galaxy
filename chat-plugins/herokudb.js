/** heroku database management commands **/

exports.commands = {
  	makesqlquery : function(target,room,user){
		if( target && Config.devstaff.indexOf(user.userid) >=0 )
	  		DatabaseManager.Heroku.makeQuery(target,this);
	},
	uploadrooms : function(target,room,user){
		if(!this.can('hotpatch')) return;
	  	DatabaseManager.files.writeRoomData(this);
	},
	herokuhelp : function( target, room, user){
		if(!this.can('hotpatch')) return;
		this.sendReply('This server is running on heroku. Chatrooms.json must be updated manually, through pastebin,'
		+'until another way is implemented...');
	}
};
