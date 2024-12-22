// Import required modules
const util = require('minecraft-server-util');
const discord = require('discord.js');
const config = require('config-yml');
const schedule = require('node-schedule');
const JsonFind = require('json-find');

// Create a new Discord client
const client = new discord.Client();

// Log in to Discord using the token from the config file
client.login(config.token);

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
			// Use JsonFind to easily access data from the response
			var query = JsonFind(response);
			// Create a string to display the current player count and server name
			let active = `Watching ${query.checkKey('onlinePlayers')} of ${query.checkKey('maxPlayers')} players on ${config.name}`;
			// Set the bot's presence using the updated setPresence method
			client.user.setPresence({
				activities: [{
					name: active,
					type: discord.ActivityType.Playing,
				}],
				status: 'online',
			});
		})
		.catch((error) => {
			// If there is an error, log it to the console
			console.error(error);
		});
});
