const Discord = require("discord.js");

const Sequelize = require('sequelize');

const PREFIX = '^';

const sequelize = new Sequelize('database', 'user', 'password', 
{
    
    //database setup i think with sqlite3 
    host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const Op = Sequelize.Op;

const config = require("./config.json");

const client = new Discord.Client();

client.login(config.token);

//I used sequelize and sqlite3 npm to create a database and sqlite extension to view content of database tables
//known bugs: will crash if server doesnt have 3 people for leaderboard command
//cant use same event name on multiple servers
//this was made to work on multiple serves at once so i need to be given role ids and reaction emotes in each server. That was added so each server could be customised

const UserList = sequelize.define('userList', 
{
    //the table which contains all users that arent bots. ids are used incase people have the same username
    username: Sequelize.STRING,
    usersId: Sequelize.STRING,
    upvotes: 
    {
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false
    },
    chosenEvent: Sequelize.STRING,
    stars: 
    {
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false
    },
    guildId: Sequelize.STRING,
    guildName: Sequelize.STRING
});

const Events = sequelize.define('events',
{
    //helps with making sure you can only select created events
    ongoingEvent: {
        type: Sequelize.STRING,
        unique: true
    },
    guildId: {
        type: Sequelize.STRING,
        unique: true
    }
});

const EventPeopleList = sequelize.define('eventPeople', 
{
    competetorsId: {
        type: Sequelize.STRING,
        unique: true
    },
    guildId: Sequelize.STRING,
    username: Sequelize.STRING,
    name: Sequelize.STRING,
    surname: Sequelize.STRING,
    interests: Sequelize.TEXT,
    age: Sequelize.INTEGER,
    participatingEvent: {
        type: Sequelize.STRING,
        unique: true
    }
});

const GuildList = sequelize.define('guildList', 
{
    guildName: Sequelize.STRING,
    upvote32RoleId: Sequelize.STRING,
    upvote64RoleId: Sequelize.STRING,
    upvote128RoleId: Sequelize.STRING,
    senseiRoleId: Sequelize.STRING,
    upvoteEmoteId: Sequelize.STRING,
    downvoteEmoteId: Sequelize.STRING,
    starEmoteId: Sequelize.STRING,
    added: Sequelize.BOOLEAN,
    guildId: {
        type: Sequelize.STRING,
        unique: true
    }
});




client.on('ready', async () => 
{
    console.log('It is on!');

    //still seems to glitch out when first trying to add members i think
    await UserList.sync();
    await Events.sync();
    await EventPeopleList.sync();
    await GuildList.sync();

    //list everyone in each server. Only here incase someone joins the server when bot is down
    client.guilds.cache.forEach(async guild => 
    {
        const membersGuild = await GuildList.findOne({where: {guildId: guild.id}});
        if(membersGuild === null)
        {
            GuildList.create({
                guildId: guild.id,
                guildName: guild.name,
                added: false
            });

            GuildList.sync();

            let channelID;
            let channels = guild.channels.cache;
            channelLoop:
            for (let c of channels) 
            {
                let channelType = c[1].type;
                if (channelType === "text") 
                {
                    channelID = c[0];
                    break channelLoop;
                }
            }
                
            let channel = client.channels.cache.get(guild.systemChannelID || channelID);
            channel.send(`Thanks for inviting me into this server! I will need you to provide me some information before we start! Can you give me id of the sensei role?`);
           
        }
        else if(membersGuild.added === true)
        {
            guild.members.cache.forEach(async member => 
                {
                    if (member.user.bot)
                    {
                        return;
                    }
                    try 
                    {
                        const userList = await UserList.findOne({where: {usersId: member.user.id, guildId: membersGuild.guildId}});
                        if(userList)
                        {
                            return //console.log('That tag already exists.');
                        };

                        const userName = await UserList.create(
                        {                                
                            usersId: member.user.id,
                            username: member.user.username,
                            guildId: membersGuild.guildId,
                            guildName: membersGuild.guildName
                        });
                        UserList.sync();
                        return //console.log(`Tag ${userName.username} added to ${userName.guildName} guild.`);
                    }
                    catch (e) 
                    {
                        if (e.name === 'SequelizeUniqueConstraintError') 
                        {
                            return //console.log('That tag already exists.');
                        }
                        return //console.log('Something went wrong with adding a tag.');
                    }
                });
                        
        }
        guild.channels.cache.forEach(channel => 
            {
                //incase someone wants to upvote something that was already in the channel but the bot was down
                if(channel.type === "text")
                {
                    channel.messages.fetch();
                }
            });    

            
    });
    

});

client.on('message', message => 
{
    //little easter egg dont mind it
    if(message.content === "Hello there")
    {
        message.channel.send("General " + message.author.username + "!");
    }
});




client.on('guildCreate', guild => 
{
    GuildList.create({
        guildId: guild.id,
        guildName: guild.name,
        added: false
    });

    GuildList.sync();

    let channelID;
    let channels = guild.channels.cache;
    channelLoop:
    for (let c of channels) 
    {
        let channelType = c[1].type;
        if (channelType === "text") 
        {
            channelID = c[0];
            break channelLoop;
        }
    }
        
    let channel = client.channels.cache.get(guild.systemChannelID || channelID);
    channel.send(`Thanks for inviting me into this server! I will need you to provide me some information before we start! Can you give me id of the sensei role?`);
   
});


client.on('messageReactionAdd', async (reaction, user) =>
{
    //increases and decreases based on reactions
    const membersGuild = await GuildList.findOne({where: {guildId: reaction.message.guild.id}});
    if(membersGuild.added === true)
    {
        if(reaction.emoji.id === membersGuild.upvoteEmoteId)
        {
            const tag = await UserList.findOne({ where: { usersId: reaction.message.author.id, guildId: membersGuild.guildId } });
            
            var reactingUser = reaction.message.reactions.cache.filter(reaction => reaction.users.cache.has(reaction.message.author.id));
            
            if(reactingUser)
            {
                try {
                    for (const reaction of reactingUser.values()) {
                        await reaction.users.remove(reaction.message.author.id);
                        //here because since the messagereactionremove will decrement by one this will even it out                        
                        await tag.increment('upvotes');
                        return;
                    }
                } catch (error) {
                    console.error('Failed to remove reactions.');
                }
                
            }


            //console.log("Upvote");
            if (tag) 
            {
                await tag.increment('upvotes');
                if(tag.upvotes + 1 >= 32)
                {
                    reaction.message.member.roles.add(membersGuild.upvote32RoleId);
                }
                else if(tag.upvotes + 1 >= 64)
                {
                    reaction.message.member.roles.remove(membersGuild.upvote32RoleId);
                    reaction.message.member.roles.add(membersGuild.upvote64RoleId);
                }
                else if(tag.upvotes + 1 >= 128)
                {
                    reaction.message.member.roles.remove(membersGuild.upvote64RoleId);
                    reaction.message.member.roles.add(membersGuild.upvote128RoleId);
                }
            }
        }
        else if(reaction.emoji.id === membersGuild.downvoteEmoteId )
        {
            const tag = await UserList.findOne({ where: { usersId: reaction.message.author.id, guildId: membersGuild.guildId } });

            var reactingUser = reaction.message.reactions.cache.filter(reaction => reaction.users.cache.has(reaction.message.author.id));
            
            if(reactingUser)
            {
                try {
                    for (const reaction of reactingUser.values()) {
                        await reaction.users.remove(reaction.message.author.id);
                        //here because since the messagereactionremove will increment by one this will even it out
                        await tag.decrement('upvotes');
                        return;
                    }
                } catch (error) {
                    //console.error('Failed to remove reactions.');
                }
                
            }

            //console.log("Downvote");
            if (tag) 
            {
                await tag.decrement('upvotes');
                if(tag.upvotes + 1 < 32)
                {
                    reaction.message.member.roles.remove(membersGuild.upvote32RoleId);
                }
                else if(tag.upvotes + 1 < 64)
                {
                    reaction.message.member.roles.add(membersGuild.upvote32RoleId);
                    reaction.message.member.roles.remove(membersGuild.upvote64RoleId);
                }
                else if(tag.upvotes + 1 < 128)
                {
                    reaction.message.member.roles.add(membersGuild.upvote64RoleId);
                    reaction.message.member.roles.remove(membersGuild.upvote128RoleId);
                }
            }
        }
        else if(reaction.emoji.id === membersGuild.starEmoteId)
        {
            const messageAuthor = await UserList.findOne({ where: { usersId: reaction.message.author.id, guildId: membersGuild.guildId } });
            
            var reactingUser = reaction.message.reactions.cache.filter(reaction => reaction.users.cache.has(user.id));
            
            var userSelf = reaction.message.reactions.cache.filter(reaction => reaction.users.cache.has(reaction.message.author.id));

            if(userSelf)
            {
                try {
                    for (const reaction of userSelf.values()) {
                        await reaction.users.remove(reaction.message.author.id);
                        //here because since the messagereactionremove will decrement by one this will even it out
                        await messageAuthor.increment('stars');
                        return;
                    }
                } catch (error) {
                    return console.error('Failed to remove reactions.');
                }
                
            }

            if(reactingUser && !user.presence.member.roles.cache.get(membersGuild.senseiRoleId))
            {
                try {
                    for (const reaction of reactingUser.values()) {
                        await reaction.users.remove(user.id);
                        //same here but this time incase someone doenst have the role
                        await messageAuthor.increment('stars');
                        return;
                    }
                } catch (error) {
                    return console.error('Failed to remove reactions.');
                }
                
            }


            console.log("Star!");
            if (messageAuthor) 
            {
                //the if statement here is incase of a bug where it doesnt actually find the user in database so no errors or crashes appear
                await messageAuthor.increment('stars');
            }
        }
    }
    else
    {
        if(reaction.message.author.id === client.user.id && reaction.message.content === "Okay, now give this message an emote that will represent an upvote in this server!")
        {
            reaction.users.cache.forEach(user => {
                if(user.presence.member.hasPermission('ADMINISTRATOR'))
                {
                    if(membersGuild.upvoteEmoteId === null)
                    {
                        membersGuild.upvoteEmoteId = reaction.emoji.id;
                        membersGuild.save();
                        return reaction.message.channel.send("Now react to that message with the downvote emoji!");
                    }
                    else if(membersGuild.downvoteEmoteId === null)
                    {
                        membersGuild.downvoteEmoteId = reaction.emoji.id;
                        membersGuild.save();
                        return reaction.message.channel.send("Now react to that message with the star emoji!");
                    }
                    else if(membersGuild.starEmoteId === null)
                    {
                        membersGuild.starEmoteId = reaction.emoji.id;
                        membersGuild.added = true;
                        membersGuild.save();
                        reaction.message.guild.members.cache.forEach(async member => 
                        {
                            if (member.user.bot)
                            {
                                return;
                            }
                        try 
                        {           
                            const userList = await UserList.create(
                            {                                
                                usersId: member.user.id,
                                username: member.user.username,
                                guildId: membersGuild.guildId,
                                guildName: membersGuild.guildName
                            });
                            UserList.sync();
                            return //console.log(`Tag ${userList.username} added to ${userList.guildName} guild.`);
                        }
                        catch (e) 
                        {
                            if (e.name === 'SequelizeUniqueConstraintError') 
                            {
                                return //console.log('That tag already exists.');
                            }
                            return //console.log('Something went wrong with adding a tag.');
                        }
                    });
                        return reaction.message.channel.send("Thank you for cooperating! The bot us now functional!");
                    }
                }
            });
        }
    } 
});
  
client.on('messageReactionRemove', async reaction => 
{
    const membersGuild = await GuildList.findOne({where: {guildId: reaction.message.guild.id}});
    if(membersGuild.added === true)
    {
        if(reaction.emoji.id === membersGuild.upvoteEmoteId)
        {
            const tag = await UserList.findOne({ where: { usersId: reaction.message.author.id, guildId: membersGuild.guildId } });

            //console.log("Upvote removed");
            if (tag) 
            {
                await tag.decrement('upvotes');
                if(tag.upvotes - 1 < 32)
                {
                    reaction.message.member.roles.remove(membersGuild.upvote32RoleId);
                }
                else if(tag.upvotes - 1 < 64)
                {
                    reaction.message.member.roles.add(membersGuild.upvote32RoleId);
                    reaction.message.member.roles.remove(membersGuild.upvote64RoleId);
                }
                else if(tag.upvotes - 1 < 128)
                {
                    reaction.message.member.roles.add(membersGuild.upvote64RoleId);
                    reaction.message.member.roles.remove(membersGuild.upvote128RoleId);
                }
            }
        
        }
        else if(reaction.emoji.id === membersGuild.downvoteEmoteId )
        {
            const tag = await UserList.findOne({ where: { usersId: reaction.message.author.id, guildId: membersGuild.guildId } });

            //console.log("Downvote removed");
            if (tag) 
            {
                await tag.increment('upvotes');
                if(tag.upvotes + 1 >= 32)
                {
                    reaction.message.member.roles.add(membersGuild.upvote32RoleId);
                }
                else if(tag.upvotes + 1 >= 64)
                {
                    reaction.message.member.roles.remove(membersGuild.upvote32RoleId);
                    reaction.message.member.roles.add(membersGuild.upvote64RoleId);
                }
                else if(tag.upvotes + 1 >= 128)
                {
                    reaction.message.member.roles.remove(membersGuild.upvote64RoleId);
                    reaction.message.member.roles.add(membersGuild.upvote128RoleId);
                }
            }
        }
        else if(reaction.emoji.id === membersGuild.starEmoteId)
        {
            const tag = await UserList.findOne({ where: { usersId: reaction.message.author.id, guildId: membersGuild.guildId } });

            //console.log("Star removed!");
            if (tag) 
            {
                await tag.decrement('stars');           
            }
        }   
    }
     
});

client.on('message', async message => 
{
    if(message.author.bot)
    {
        return;
    }
    else if(message.channel.type === "dm")
    {
        const userList = await UserList.findOne({ where: { usersId: message.author.id, [Op.not]: [{chosenEvent: null}]} });
        //this can bug out if a person tries to join diffrent events from diffrent guilds at the same time but since i cant get the right guild id from dms this is only way to do this
        if(userList)
        {
            const selectedEvent = await Events.findOne({where: {ongoingEvent: userList.chosenEvent, guildId: userList.guildId }});
            if(selectedEvent)
            {
                const joiningUser = await EventPeopleList.findOne({ where: { competetorsId: userList.usersId, participatingEvent: userList.chosenEvent, guildId: userList.guildId } });
                if(joiningUser)
                {
                    if(joiningUser.name === null)
                    {
                        joiningUser.name = message.toString();
                        joiningUser.save();
                        joiningUser.reload();
                        return message.author.send(`Ok! Now, what is your surname!`);
                    }
                    else if(joiningUser.surname === null)
                    {
                        joiningUser.surname = message.toString();
                        joiningUser.save();
                        joiningUser.reload();
                        return message.author.send(`Ok! Now, what are your interests!`);                 
                    }
                    else if(joiningUser.interests === null)
                    {
                        joiningUser.interests = message.toString();
                        joiningUser.reload();
                        joiningUser.save();
                        return message.author.send(`Ok! Now, how old are you!`)
                    }                        
                    else if(joiningUser.age === null)
                    {
                        if(parseInt(message))
                        {
                            joiningUser.age = parseInt(message);                                    
                            joiningUser.username = message.author.username;
                            userList.chosenEvent = null;
                            userList.save();                                
                            joiningUser.save();
                            return message.author.send("Thank you for joining the event!");
                        }
                    return message.author.send("Thats not a valid answer!");
                    }
                }
            }
            else
            {
                //incase someone doesnt finish registering before event is ended
                userList.chosenEvent = null;
            }
        }     
    }
    else
    {
        const membersGuild = await GuildList.findOne({where: {guildId: message.guild.id}});
        if(membersGuild.added === true)
        {
            if (message.content.startsWith(PREFIX) && message.channel.type != "dm") 
            {
                const input = message.content.slice(PREFIX.length).split(' ');
                const command = input.shift();
                const commandArgs = input.join(' ');
    
                if(command === 'startEvent' && message.member.roles.cache.get(membersGuild.senseiRoleId))
                {  
                    const selectedEvent = await Events.findOne({where: {ongoingEvent: commandArgs}});
                    //only here couse i dont like multiple event with the same name as it might create bugs for joining in more than one server at once
                    if(selectedEvent)
                    {
                        return message.channel.send("Event name taken!");
                    }
    
                    Events.create({
                        ongoingEvent: commandArgs,
                        guildId: message.guild.id
                    });
    
                    eventName = commandArgs;
    
                    message.channel.send(`Event ${commandArgs} has been made!`);
                }
                else if(command === 'deleteEvent' && message.member.roles.cache.get(membersGuild.senseiRoleId))
                {
                    const selectedEvent = await Events.findOne({where: {ongoingEvent: commandArgs, guildId: message.guild.id}});
                    if(selectedEvent)
                    {
                        await selectedEvent.destroy();
                        await EventPeopleList.destroy({where: {participatingEvent: commandArgs, guildId: message.guild.id}});
                        return message.channel.send("Event ended!");
                    }
    
                    return message.channel.send("There is no such event going on!");
                }
                else if(command === 'joinEvent')
                {
                    const selectedEvent = await Events.findOne({where: {ongoingEvent: commandArgs, guildId: message.guild.id}});
                    if(selectedEvent)
                    {
                        const eventPerson = EventPeopleList.findOne({where: { competetorsId: message.author.id, participatingEvent: commandArgs, guildId: message.guild.id }});
                        if(eventPerson)
                        {
                            const userList = await UserList.findOne({ where: { usersId: message.author.id, guildId: message.guild.id } });
                            if(userList)
                            {
                                userList.chosenEvent = commandArgs;
    
                                userList.save();
    
                                const joiningUser = await EventPeopleList.findOne({ where: { competetorsId: userList.usersId, participatingEvent: userList.chosenEvent, guildId: userList.guildId } });
                                if(joiningUser)
                                {
                                    if(joiningUser.name === null)
                                    {
                                        message.author.send("You may continue registering from where you left off!");           
                                        return message.author.send(`What is your name!`);
                                    }
                                    else if(joiningUser.surname === null)
                                    {
                                        message.author.send("You may continue registering from where you left off!");
                                        return message.author.send(`What is your name!`);                 
                                    }
                                    else if(joiningUser.interests === null)
                                    {
                                        message.author.send("You may continue registering from where you left off!");
                                        return message.author.send(`What are your interests!`);
                                    }                        
                                    else if(joiningUser.age === null)
                                    {
                                        message.author.send("You may continue registering from where you left off!");
                                        return message.author.send(`How old are you?`);
                                    }
                                    else
                                    {
                                        userList.chosenEvent = null;
    
                                        userList.save();
    
                                        return message.channel.send(`You already have finished registering for this event!`);
                                    }
                                }
                            }
                        }    
    
                        const tag = await UserList.findOne({ where: { usersId: message.author.id, guildId: message.guild.id } });
                        if(tag)
                        {
                            tag.chosenEvent = commandArgs;
    
                            tag.save();
    
                            EventPeopleList.create({
                                competetorsId: message.author.id,
                                participatingEvent: commandArgs,
                                guildId: message.guild.id
                            });
    
                            return message.author.send("Thanks for joing the event! What is your name?");           
                        }
                        return message.channel.send(`You might not be added to the server user list! Please ask a mod or an admin to add you to the server user list if you get this message!`);
    
                    }
    
                    return message.channel.send(`There is no such event as ${commandArgs}!`);
                }
                else if(command === 'myStats')
                {
                    const userSelf = await UserList.findOne({ where: { usersId: message.author.id, guildId: message.guild.id  } });
                    

                    if (userSelf) 
                    {
                        const usersGreaterInKarma = await UserList.count({ where: { upvotes: {[Op.gt]: userSelf.upvotes}, guildId: message.guild.id} });
                        const usersGreaterInStars = await UserList.count({ where: { stars: {[Op.gt]: userSelf.stars}, guildId: message.guild.id } });
                        return message.channel.send(`You have ${userSelf.get('upvotes')} karma and ${userSelf.get('stars')} stars. You are ${usersGreaterInKarma + 1}. place on the karma leaderboard and ${usersGreaterInStars + 1}. in the star leaderboard!`);
                    } 
                }
                else if(command === 'reloadUserList' && message.member.roles.cache.get(membersGuild.senseiRoleId))
                {
                    UserList.sync();
    
                    message.guild.members.cache.forEach(async member => 
                        {
                            if (member.user.bot)
                            {
                                return;
                            }
                    try 
                    {   
                        const userList = await UserList.findOne({where: {usersId: member.user.id, guildId: membersGuild.guildId}});
                            if(userList)
                            {
                                return console.log('That tag already exists.');
                            };            
                        const userName = await UserList.create(
                        {                                
                            usersId: member.user.id,
                            username: member.user.username,
                            guildId: membersGuild.guildId,
                            guildName: membersGuild.guildName
                        });
                        UserList.sync();
                        return console.log(`Tag ${userName.username} added to ${userName.guildName} guild.`);
                    }
                    catch (e) 
                    {
                        if (e.name === 'SequelizeUniqueConstraintError') 
                        {
                            return console.log('That tag already exists.');
                        }
                        return console.log('Something went wrong with adding a tag.');
                    }
                });
                }
                else if(command === 'leaderboard')
                {
                    const firstLeader = await UserList.findOne({
                        where:{guildId: message.guild.id},
                        order: [['upvotes', 'DESC']],
                        limit: 1 
                    });
                    const secondLeader = await UserList.findOne({
                        where:{guildId: message.guild.id},
                        order: [['upvotes', 'DESC']],
                        limit: 1,
                        offset: 1
                    });
                    const thirdLeader = await UserList.findOne({
                        where:{guildId: message.guild.id},
                        order: [['upvotes', 'DESC']],
                        limit: 1,
                        offset: 2
                    });
                    return message.channel.send(`Current top 3:\nFirst: ${firstLeader.username} with ${firstLeader.upvotes} karma;\nSecond: ${secondLeader.username} with ${secondLeader.upvotes} karma;\nThird: ${thirdLeader.username} with ${thirdLeader.upvotes} karma!`);
                }
                else if(command === 'starboard')
                {
                    const firstLeader = await UserList.findOne({
                        where:{guildId: message.guild.id},
                        order: [['stars', 'DESC']],
                        limit: 1 
                    });
                    const secondLeader = await UserList.findOne({
                        where:{guildId: message.guild.id},
                        order: [['stars', 'DESC']],
                        limit: 1,
                        offset: 1
                    });
                    const thirdLeader = await UserList.findOne({
                        where:{guildId: message.guild.id},
                        order: [['stars', 'DESC']],
                        limit: 1,
                        offset: 2
                    });
                    return message.channel.send(`Current top 3:\nFirst: ${firstLeader.username} with ${firstLeader.stars} stars;\nSecond: ${secondLeader.username} with ${secondLeader.stars} stars;\nThird: ${thirdLeader.username} with ${thirdLeader.stars} stars!`);
                }
                else if(command === 'giveStar'  && message.member.roles.cache.get(membersGuild.senseiRoleId))
                {
                    //for when you want to give a star/special upvote from sensei role but it isnt because of a message you can react to with the star reaction
                    const userList = await UserList.findOne({ where: { usersId: commandArgs } });
                    //I use ids couse theyre easier to manage if people have the same username
                    userList.increment('stars');
                }
                else
                {
                    return message.channel.send(`You either don't have access to that command or have writen it incorectly!`);
                }
            }
        }
        else
        {
            if(message.author.presence.member.hasPermission('ADMINISTRATOR') && message.guild.roles.cache.get(message.toString()))
            {
    
                if(membersGuild.senseiRoleId === null)
                {
                    membersGuild.senseiRoleId = message.toString();
                    membersGuild.save();
                    return message.channel.send("Okay, now provide me with the id of the role given to people with 32 upvotes!");
                }
                else if(membersGuild.upvote32RoleId === null)
                {
                    membersGuild.upvote32RoleId = message.toString();
                    membersGuild.save();
                    return message.channel.send("Okay, now provide me with the id of the role given to people with 64 upvotes!");
                }
                else if(membersGuild.upvote64RoleId === null)
                {
                    membersGuild.upvote64RoleId = message.toString();
                    membersGuild.save();
                    return message.channel.send("Okay, now provide me with the id of the role given to people with 128 upvotes!");
                }
                else if(membersGuild.upvote128RoleId === null)
                {
                    membersGuild.upvote128RoleId = message.toString();
                    membersGuild.save();
                    return message.channel.send("Okay, now give this message an emote that will represent an upvote in this server!");
                }
            }
        }
    }


});

client.on('guildMemberAdd', async member => 
{
    const membersGuild = await GuildList.findOne({where: {guildId: member.guild.id}});
    if(membersGuild.added === true)
    {
                if (member.user.bot)
                {
                    return;
                }
                try 
                {
                    const userList = await UserList.findOne({where: {usersId: member.user.id, guildId: membersGuild.guildId}});
                    if(userList)
                    {
                        return console.log('That tag already exists.');
                    };           
                    const userName = await UserList.create(
                    {                                
                        usersId: member.user.id,
                        username: member.user.username,
                        guildId: membersGuild.guildId,
                        guildName: membersGuild.guildName
                    });
                    UserList.sync();
                    return console.log(`Tag ${userName.username} added to ${userName.guildName} guild.`);
                }
                catch (e) 
                {
                    if (e.name === 'SequelizeUniqueConstraintError') 
                    {
                        return console.log('That tag already exists.');
                    }
                    return console.log('Something went wrong with adding a tag.');
                }
                
    }
    
});



