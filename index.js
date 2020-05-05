const Discord = require("discord.io")
const logger = require("winston")
const auth = require("./auth.json")
const Conf = require("conf")
const config = new Conf()

logger.remove(logger.transports.Console)
logger.add(new logger.transports.Console(), {
	colorize: true,
})
logger.level = "debug"

const bot = new Discord.Client({
	token: auth.token,
	autorun: true,
})

const state = {
	queues: [],
}

const saveState = () => {
	config.set("state", state)
}

const getQueue = (user) => {
	return state.queues[user]
}

const deleteQueue = (user) => {
	state.queues = state.queues.splice(user, 1)
	saveState()
}

const addQueue = (user, queue) => {
	state.queues[user] = queue
	saveState()
}

bot.on("ready", function (evt) {
	logger.info("Connected")
	logger.info("Logged in as: ")
	logger.info(bot.username + " - (" + bot.id + ")")
})

bot.on("message", function (user, userID, channelID, message, evt) {
	// Our bot needs to know if it will execute a command
	// It will listen for messages that will start with `!`
	if (message.substring(0, 1) == "!") {
		const args = message.substring(1).split(" ")
		const cmd = args[0]

		const cmdArgs = args.splice(1)
		switch (cmd) {
			case "ping":
				bot.sendMessage({
					to: channelID,
					message: "Pong!",
				})
				break
			case "luo":
				const oldQueue = getQueue(user)
				if (oldQueue) {
					bot.sendMessage({
						to: userID,
						message: `Olet tehnyt jo jonon, jonka koodi on *${oldQueue.dodoCode}*. Jos tämä jono ei ole enää voimassa, tuhoa se komennolla *!poista* ennen uuden aloittamista.`,
					})
					break
				}
				const dodoCode = cmdArgs[0]
				if (!isValidDodoCode(dodoCode)) {
					bot.sendMessage({
						to: userID,
						message: `Muuten ihan kiva, mutta *${dodoCode}* ei näytä olevan kunnollinen Dodo Code.`,
					})
					break
				}
				const visitorNumber = cmdArgs[1]
				if (!isValidVisitorNumber(visitorNumber)) {
					bot.sendMessage({
						to: userID,
						message: `Sun matematiikastasi en tiedä, mutta *${visitorNumber}* ei näytä mulle numerolta.`,
					})
					break
				}
				const newQueue = {
					userID,
					user,
					dodoCode,
					visitorNumber,
					visitors: [],
				}
				addQueue(user, newQueue)
				logger.info(`${user} created a queue.`)
				bot.sendMessage({
					to: userID,
					message: `Jono on luotu nimellä *${user}*. Tarkista vielä että meni oikein: Dodo Code on *${dodoCode}* ja kerralla sisään päästetään *${visitorNumber}* vierasta.`,
				})
				break
			case "poista":
				const queue = getQueue(user)
				if (!queue) {
					bot.sendMessage({
						to: userID,
						message: `Sinulla ei ole jonoa.`,
					})
					break
				}
				deleteQueue(user)
				logger.info(`${user} deleted a queue.`)
				bot.sendMessage({
					to: userID,
					message: `Jonosi poistettiin.`,
				})
				break
			case "liity":
				const queueName = cmdArgs[0]

				break
		}
	}
})

const isValidDodoCode = (dodoCode) => {
	const regex = RegExp("^[a-zA-Z0-9]{5}$")
	return regex.test(dodoCode)
}

const isValidVisitorNumber = (visitorNumber) => {
	const regex = RegExp("^[0-9]{1}$")
	return regex.test(visitorNumber)
}
