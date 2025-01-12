// Import required modules
const util = require('mc-server-utilities');
const config = require('config-yml');
const schedule = require('node-schedule');
const JsonFind = require('json-find');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

// Creating discord client
const client = new Client({
  intents: [
    'GuildPresences'
  ]
});

// Log in to Discord using the token from the config file
client.login(config.token);
console.log(3)
// Event listener for when the bot is ready
client.on('ready', () => {
	// Log a message to the console indicating the bot is logged in
	console.log(`Logged in as ${client.user.tag}!`);
});

// Schedule a job to run every 15 seconds
const job = schedule.scheduleJob('*/15 * * * * *', function(){
	// Get the status of the Minecraft server using the IP address from the config file
	util.status(config.ip)
		// If the status request is successful
		.then((response) => {
			//console.log(response) // Debugging snippet in case the query response in off.
			// Use JsonFind to easily access data from the response
			var query = JsonFind(response);
			var players = JsonFind(query.checkKey('players'))
			// Create a string to display the current player count and server name
			let active = `Watching ${players.checkKey('online')} of ${players.checkKey('max')} players on ${config.name}`;
			// Set the bot's presence using the updated setPresence method
			client.user.setPresence({
				activities: [{
					name: active,
					type: ActivityType.Custom,
				}],
				status: 'online',
			});
		})
		.catch((error) => {
			// If there is an error, log it to the console
			console.error(error);
		});
});
