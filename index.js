const util = require('minecraft-server-util');
const discord = require('discord.js');
const config = require('config-yml');
const schedule = require('node-schedule');
const JsonFind = require('json-find');

const client = new discord.Client();

client.login(config.token);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

const job = schedule.scheduleJob('*/5 * * * * *', function(){
	util.query(config.ip)
		.then((response) => {
			console.log(response);
			var query = JsonFind(response);
			let active = `Watching ${query.checkKey('onlinePlayers')} of ${query.checkKey('maxPlayers')} players on ${config.name}`;
			client.user.setActivity(active, {
		  	type: "PLAYING",
		  	name: config.name
			});
		})
		.catch((error) => {
			console.error(error);
			client.user.setActivity("ERROR -> Check config or server query status!", {
		  	type: "PLAYING",
		  	name: config.name
			});
		});
});
