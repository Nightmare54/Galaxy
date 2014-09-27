/** heroku database management commands **/

exports.commands = {
  makesqlquery : function(target,room,user){
		if( this.can('hotpatch') && target )
		  DatabaseManager.Heroku.makeQuery(target,this);
	}
};
