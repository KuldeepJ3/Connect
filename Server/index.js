require('dotenv').config();
const express = require('express')
const app = express()
const PORT = process.env.PORT || 8000 
const cors = require('cors')
const ConnectDB = require('./Connect/connect')
const Router = require('./Routes/routes')
const path = require('path')

app.use(cors({
    origin: true,
    credentials: true
}));

const dbURI = process.env.MONGO_URI;
ConnectDB(dbURI)

app.use(express.json())
app.use('/', Router)

app.listen(PORT, () => {
    console.log(`Backend Listening at ${PORT}`)
})