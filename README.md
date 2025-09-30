# Minecraft-Player-Count-Discord-Bot

What is this?

This is a simple Discord bot script, written in discord.js, which shows the playercount of a Minecraft-server in a playing status.
To use this, you'll need node.js.

To setup the bot, simply edit the "config-example.yml" to your needs and rename it to "config.yml".
Then you run `npm i` from any command-prompt that can run `npm`-commands.

Then for executing the bot simply type in `npm start` and hit enter.



## Feature list:
### V1
* [x] List player count
* [x] Display a custom name for the server
* [x] Debug output
* [x] Use custom refresh interval (via refresh-interval in config, seconds)

### V2
* [ ] Add support for multiple minecraft servers using an command to be executed by a discord server admin (manage server permission on the senders end).
    * This should act as a per server option for a discord server to manage.
    * This will act as a mode set in the config file. The other config parts will stay for a demo of the app
    * This should work using a mariadb database. This should automatically be created when setting up for the first time.
    * This mode should make use of a message for each server. The database will therefore store the message id and edit it.
    * The message should contain the relevant information for this in an embed.
    * If possible, the bot should fetch the server icon for display in the embed.
    * The embed should be updated as configured in the config.
    * When this mode is used, the status will still be used as configured, but instead of displaying "Watching X out of Y players" it should display "Watching X servers".
* [ ] Add a command for getting a minecraft server's player count on demand
    * the answer should be sent only to the asking user. Other users shouldn't be able to see the message.
    * this function should be reserved for direct messages or group chats. Servers will not get this feature.
### V3
* [ ] Add sharding support



If any errors come to life, please write at the issue tab.
If you have feature requests, you can also write them in the issue tab.


Have fun with the bot! ;D


Kind regards

MCLP2005
