const Discord = require("discord.io")
const logger = require("winston")
const Conf = require("conf")
const config = new Conf()

if (process.env.NODE_ENV !== "production") {
	require("dotenv").config()
}

logger.remove(logger.transports.Console)
logger.add(new logger.transports.Console(), {
	colorize: true,
})
logger.level = "debug"

const bot = new Discord.Client({
	token: process.env.BOT_TOKEN,
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
	delete state.queues[user]
	saveState()
	logger.info(`${user} deleted a queue.`)
}

const addQueue = (user, queue) => {
	state.queues[user] = queue
	saveState()
	logger.info(`${user} created a queue.`)
}

const addToQueue = (user, userID, queueName) => {
	const lastVisitor =
		state.queues[queueName].visitors[
			state.queues[queueName].visitors.length - 1
		]
	if (lastVisitor != undefined && lastVisitor.userID == userID) {
		//return -1
	}
	const visitor = {
		user,
		userID,
		status: "jonossa",
	}
	state.queues[queueName].visitors.push(visitor)
	saveState()
	logger.info(`${user} added to queue ${queueName}.`)
	checkQueue(queueName)
	return 1
}

const sendCode = (userID, queue) => {
	bot.sendMessage({
		to: userID,
		message: `Sinun vuorosi jonossa ${queue.user}! Dodo Code on *${queue.dodoCode}*. Siirry ripeästi saarelle. Kun olet matkalla, lähetä botille viesti *!jono matkalla*. Kun lähdet saarelta, lähetä botille viesti *!jono kotiin*.`,
	})
}

const checkQueue = (queueName) => {
	logger.info(`Checking queue ${queueName}:`)
	const visitorsToCheck = Math.min(
		state.queues[queueName].visitorNumber,
		state.queues[queueName].visitors.length
	)
	for (let index = 0; index < visitorsToCheck; index++) {
		const visitor = state.queues[queueName].visitors[index]
		if (visitor.status == "jonossa") {
			sendCode(visitor.userID, state.queues[queueName])
			state.queues[queueName].visitors[index].status = "saanut koodin"
			logger.info(`Sent code to ${visitor.user}.`)
		}
	}
}

const findUserQueue = (user, status) => {
	for (const queue in state.queues) {
		if (
			state.queues[queue].visitors.find(
				(u) => u.user == user && u.status == status
			) != undefined
		) {
			return queue
		}
	}
	return false
}

const updateUserStatus = (user, status, queueName) => {
	const userIndex = state.queues[queueName].visitors.findIndex(
		(u) => u.user == user
	)
	state.queues[queueName].visitors[userIndex].status = status
	logger.info(`Updated user ${user} status in ${queueName} to '${status}'`)
	saveState()
}

const removeUserFromQueue = (user, queueName) => {
	const userIndex = state.queues[queueName].visitors.findIndex(
		(u) => u.user == user
	)
	if (userIndex == -1) return -1
	state.queues[queueName].visitors.splice(userIndex, 1)
	logger.info(`Removed user ${user} from ${queueName}`)
	saveState()
	checkQueue(queueName)
	return 1
}

const sendHelp = (userID) => {
	const message = `Voit luoda oman jonon komennolla *!jono luo ABCDE n*, missä *ABCDE* on Dodo Code ja n on yhtä aikaa saarelle haluamiesi käyttäjien lukumäärä. Tämä luo jonon, jonka nimeksi tulee Discord-käyttäjätunnuksesi (ei siis nicknamesi palvelimella). Tämä komento kannattaa lähettää botille yksityisviestillä, jotta Dodo Codesi ei näy kanavalla!

Jonoon liitytään komennolla *!jono liity [nimi]*, jolla menet jonon viimeiseksi. Et voi liittyä samaan jonoon kahta kertaa. Jos haluat käydä saarella useamman kerran, sinun tulee liittyä jonoon uudestaan kun olet palannut kotiin ensimmäiseltä käynniltäsi.

Kun jono etenee ja on sinun vuorosi päästä saarelle, saat botilta yksityisviestin, jossa kerrotaan Dodo Code. Nyt sinun pitää siirtyä saarelle mahdollisimman ripeästi. Kun olet lähtenyt lentokentältä, lähetä komento *!jono matkalla*. Kun olet vieraillut saarella ja poistut, lähetä komento *!jono kotiin*. Tämä poistaa sinut jonosta ja vapauttaa paikan seuraavalle jonottajalle.

Jos haluat poistaa jonosi, lähetä komento *!jono poista*. Se hävittää jonosi saman tien, vailla varoitusta ja perumismahdollisuutta, eli käytä harkiten.

Komennolla *!jono näytä [jononnimi]* botti lähettää sinulle viestin, jossa näkyy jonon tilanne tällä hetkellä. Jonottajien nimen perässä on tila, joka voi olla "jonossa", "saanut koodin" tai "saarella".

Jos joku jumittaa jonossa eikä esim. tulekaan saarelle ajoissa tai ei muista poistua jonosta, jonon omistaja voi potkia väkeä jonosta pois komennolla *!jono potkaise [käyttäjä]*. Tämä poistaa nimetyn käyttäjän jonostasi.`
	bot.sendMessage({
		to: userID,
		message,
	})
}

bot.on("ready", function (evt) {
	logger.info("Connected")
	logger.info("Logged in as: ")
	logger.info(bot.username + " - (" + bot.id + ")")
})

bot.on("message", function (user, userID, channelID, message, evt) {
	if (message.substring(0, 5) == "!jono") {
		const args = message.substring(6).split(" ")
		const cmd = args[0]

		if (!cmd) {
			sendHelp(userID)
		}

		const cmdArgs = args.splice(1)
		let queueName = ""
		switch (cmd) {
			case "ping":
				bot.sendMessage({
					to: channelID,
					message: "Pong!",
				})
				console.log()
				break
			case "luo":
				const oldQueue = getQueue(sanitizeUsername(user))
				if (oldQueue) {
					bot.sendMessage({
						to: userID,
						message: `Olet tehnyt jo jonon, jonka koodi on *${oldQueue.dodoCode}*. Jos tämä jono ei ole enää voimassa, tuhoa se komennolla *!jono poista* ennen uuden aloittamista.`,
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
					user: sanitizeUsername(user),
					dodoCode,
					visitorNumber,
					visitors: [],
				}
				addQueue(user, newQueue)
				bot.sendMessage({
					to: userID,
					message: `Jono on luotu nimellä *${sanitizeUsername(
						user
					)}*. Tarkista vielä että meni oikein: Dodo Code on *${dodoCode}* ja kerralla sisään päästetään *${visitorNumber}* vierasta.`,
				})
				break
			case "poista":
				const queueToRemove = getQueue(sanitizeUsername(user))
				if (!queueToRemove) {
					bot.sendMessage({
						to: userID,
						message: `Sinulla ei ole jonoa.`,
					})
					break
				}
				deleteQueue(sanitizeUsername(user))
				bot.sendMessage({
					to: userID,
					message: `Jonosi poistettiin.`,
				})
				break
			case "liity":
				queueName = cmdArgs[0]
				const queueToJoin = getQueue(queueName)
				if (queueToJoin == undefined) {
					bot.sendMessage({
						to: userID,
						message: `Jonoa *${queueName}* ei löytynyt.`,
					})
					break
				}

				const response = addToQueue(user, userID, queueName)
				if (response == 1) {
					bot.sendMessage({
						to: userID,
						message: `Liityit jonoon *${queueName}*.`,
					})
				}
				if (response == -1) {
					bot.sendMessage({
						to: userID,
						message:
							"Olet jo jonon viimeisenä, et voi liittyä jonoon kahta kertaa peräkkäin.",
					})
				}
				break
			case "näytä":
				queueName = cmdArgs[0]
				const queueToShow = getQueue(queueName)
				if (queueToShow == undefined) {
					bot.sendMessage({
						to: userID,
						message: `Jonoa *${queueName}* ei ole.`,
					})
					break
				}
				const visitorList = queueToShow.visitors
					.map((visitor) => visitor.user + " (" + visitor.status + ")")
					.join("\n")
				bot.sendMessage({
					to: userID,
					message: `Jonossa *${queueName}* ovat:\n\n${visitorList}`,
				})
				break
			case "matkalla":
				const queueToUpdate = findUserQueue(user, "saanut koodin")
				if (queueToUpdate) {
					updateUserStatus(user, "saarella", queueToUpdate)
					bot.sendMessage({
						to: userID,
						message: `Tilasi jonossa *${queueToUpdate}* on nyt 'saarella'.`,
					})
				} else {
					bot.sendMessage({
						to: userID,
						message: "Et ole missään jonossa matkustusvuorossa.",
					})
				}
				break
			case "kotiin":
				const queueToLeave = findUserQueue(user, "saarella")
				if (queueToLeave) {
					const leaveResponse = removeUserFromQueue(user, queueToLeave)
					if (leaveResponse == 1) {
						bot.sendMessage({
							to: userID,
							message: `Sinut on nyt poistettu jonosta *${queueToLeave}*. Kiitos käynnistä, tervetuloa uudelleen!`,
						})
					}
				} else {
					bot.sendMessage({
						to: userID,
						message:
							"Et ole millään saarella. Muistitko antaa komennon *!jono matkalla*?.",
					})
				}
				break
			case "potkaise":
				userToKick = cmdArgs[0]
				const queueToKick = getQueue(sanitizeUsername(user))
				if (queueToKick == undefined) {
					bot.sendMessage({
						to: userID,
						message: `Sinulla ei ole jonoa mitä potkia.`,
					})
					break
				}

				const kickResponse = removeUserFromQueue(
					userToKick,
					sanitizeUsername(user)
				)
				if (kickResponse == 1) {
					bot.sendMessage({
						to: userID,
						message: `Käyttäjä *${userToKick}* poistettiin jonosta *${sanitizeUsername(
							user
						)}*.`,
					})
				}
				if (kickResponse == -1) {
					bot.sendMessage({
						to: userID,
						message: `Potkaisit tyhjää.`,
					})
				}
				break
		}
	}
})

const isValidDodoCode = (dodoCode) => {
	const regex = RegExp("^[a-zA-Z0-9]{5}$")
	return regex.test(dodoCode)
}

const isValidVisitorNumber = (visitorNumber) => {
	const regex = RegExp("^[0-9]{1,2}$")
	return regex.test(visitorNumber)
}

const sanitizeUsername = (username) => {
	return username.replace(/\s/, "")
}
