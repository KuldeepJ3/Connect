const mongoose = require('mongoose')
const dns = require('dns');

dns.setServers(['1.1.1.1', '8.8.8.8']);

const ConnectDB = async(url) => {
    await mongoose.connect(url)
    console.log("Local DataBase Connected!")
}

module.exports = ConnectDB;