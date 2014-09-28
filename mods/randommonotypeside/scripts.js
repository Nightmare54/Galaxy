exports.BattleScripts = {
randomMonosideTeam: function(side) {
//this tier intends to use Random Battle sets and force both teams to use the same pokemon type.
var teamdexno = [];
var team = [];
var typesarray = ["Bug", "Dragon", "Electric", "Water", "Fire", "Flying", "Dark", "Grass", "Ground", "Ice", "Normal", "Poison", "Psychic", "Rock", "Ghost", "Fighting", "Steel"];
var sidetype = typesarray.sample()
//var banarray = [351,413,479,492,493,555,648];
//Kecleon, Castform, Wormadam, Rotom, Shaymin, Arceus, Darmanitan, Meloetta
//console.log(side.id + "\'s type is " + sidetype)
//pick six random pokemon--no repeats, even among formes
//also need to either normalize for formes or select formes at random
//unreleased are okay. No CAP for now, but maybe at some later date
for (var i=0; i<6; i++)
{
while (true) {
do
{
var x=Math.floor(Math.random()*649)+1;
//console.log(x);
//if(banarray.indexOf(x) != -1) continue;
var formes = [];
for (var j in this.data.Pokedex) {
if (this.data.Pokedex[j].num === x && this.getTemplate(this.data.Pokedex[j].species).learnset) {
formes.push(this.data.Pokedex[j].species);
}
}
for (var j=0; j<formes.length; j++) {
var poke = formes[j];
var template = this.getTemplate(poke);
var type1 = template.types[0];
if (!type1) {
console.log("Debug: type1 was undefined.");
break;
}
var type2 = template.types[1];
if (!type2) {
//console.log(i + ", " + x + ", " + template.species + ", only " + type1);
if (i==0) {
var righttype = false;
//first poke will always have double typing
}
else {
var righttype = (type1==sidetype);
}
}
else {
//console.log(i + ", " + x + ", " + template.species + ", " + type1 + " and " + type2);
var righttype = (type1==sidetype || type2==sidetype);
}
if (righttype) break;
}
}
while (!righttype);
if (teamdexno.indexOf(x) === -1) {
teamdexno.push(x);
break;
}
}
}
for (var i=0; i<6; i++) {
//choose forme
var formes = [];
for (var j in this.data.Pokedex) {
if (this.data.Pokedex[j].num === teamdexno[i] && this.getTemplate(this.data.Pokedex[j].species).learnset) {
var prototemplate = this.getTemplate(this.data.Pokedex[j].species);
if (!prototemplate.types[1]) {
if (i==0) {
var righttype = false;
} else {
var righttype = (prototemplate.types[0]==sidetype);
}
} else {
var righttype = (prototemplate.types[0]==sidetype || prototemplate.types[1]==sidetype);
}
if (righttype) {
formes.push(this.data.Pokedex[j].species);
}
}
}
var poke = formes.sample();
var template = this.getTemplate(poke);
var set = this.randomSet(template, i);
team.push(set);
}
//console.log(team);
return team;
},
};
