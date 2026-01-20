const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const chalk = require("chalk")

async function startFrioBot() {
    const { state, saveCreds } = await useMultiFileAuthState('FrioSession')
    const { version } = await fetchLatestBaileysVersion()
    
    const conn = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    })

    if (!conn.authState.creds.registered) {
        console.log(chalk.yellow("Connection stabilizing... code appearing in 10s"))
        setTimeout(async () => {
            try {
                const phoneNumber = "2348076874766"
                const code = await conn.requestPairingCode(phoneNumber.trim())
                console.log(chalk.black(chalk.bgCyan(`Pairing Code: ${code}`)))
            } catch (e) {
                console.log(chalk.red("Error requesting code. Check if number is correct."))
            }
        }, 10000)
    }

    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) { 
                startFrioBot()
            }
        } else if (connection === "open") {
            console.log(chalk.green("THE-FRiO-BOT is Online"))
        }
    })

    conn.ev.on("creds.update", saveCreds)

    conn.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0]
            if (!m.message) return
            const from = m.key.remoteJid
            const type = Object.keys(m.message)[0]
            const body = (type === 'conversation') ? m.message.conversation : (type == 'extendedTextMessage') ? m.message.extendedTextMessage.text : ''
            
            if (body.startsWith('@ping')) {
                await conn.sendMessage(from, { text: 'Pong! 🏓 THE-FRiO-BOT is active.' }, { quoted: m })
            }

            if (body.startsWith('@daily')) {
                const lastDaily = db[sender].lastDaily
                const cooldown = 86400000 
                if (Date.now() - lastDaily < cooldown) {
                    const remaining = cooldown - (Date.now() - lastDaily)
                    const hours = Math.floor(remaining / 3600000)
                    const minutes = Math.floor((remaining % 3600000) / 60000)
                    return await conn.sendMessage(from, { text: `⏳ You already claimed today. Come back in ${hours}h ${minutes}m.` }, { quoted: m })
                }
                if (!isCreator) db[sender].balance = (db[sender].balance || 0) + 1000
                db[sender].lastDaily = Date.now()
                fs.writeFileSync('./economyData.json', JSON.stringify(db, null, 2))
                await conn.sendMessage(from, { text: `✅ Daily reward of 1,000 coins claimed!` }, { quoted: m })
            }

            if (body.startsWith('@lb')) {
                let board = Object.keys(db)
                    .filter(id => id !== "2348076874766@s.whatsapp.net")
                    .map(id => ({ id, balance: db[id].balance || 0 }))
                    .sort((a, b) => b.balance - a.balance)
                    .slice(0, 10)
                
                let text = `🏆 *THE-FRiO-BOT LEADERBOARD*\n\n`
                board.forEach((user, i) => {
                    text += `${i + 1}. @${user.id.split('@')[0]} - ${user.balance}\n`
                })
                await conn.sendMessage(from, { text, mentions: board.map(u => u.id) }, { quoted: m })
            }
        } catch (err) {
            console.log(err)
        }
    })
}

startFrioBot()
