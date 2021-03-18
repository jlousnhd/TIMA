const tima_shared = require("./tima-shared");
const User = tima_shared.User;
const Conversation = tima_shared.Conversation;
const Message = tima_shared.Message;

const WebSocket = require("ws");
const MongoClient = require('mongodb').MongoClient;
const express = require("express");
const http = require("http");

const app = express();

const returnMessage = function(message) {

    message = JSON.stringify(message);

    if(this && this.send)
        this.send(message);

}

const checkLoggedIn = async function() {

    if(!this || !(this.user))
        throw "Only logged in users can perform this function";

    // Check to make sure a user is logged in and they're admin and enabled
    const approved = await global.users.findOne({
        username: this.user.username,
        disabled: false
    });

    if(!approved)
        throw "Only logged in users can perform this function";

};

const checkAdmin = async function() {

    if(!this || !(this.user))
        throw "Only admins can perform this action";

    // Check to make sure a user is logged in and they're admin and enabled
    const approved = await global.users.findOne({
        username: this.user.username,
        admin: true,
        disabled: false
    });

    if(!approved)
        throw "Only admins can perform this action";

};

const addUser = async function(username, password, admin) {

    try {

        // If a user session is already open, no creating new users
        if(this.user)
            throw "Can't create an account while signed in";

        // Check if that name is taken
        let existing = await global.users.findOne({ username: username });

        if(existing)
            throw "The username \"" + username + "\" is already taken";

        // Add the user
        await global.users.insertOne({
            username: username,
            password: password,
            admin: admin,
            disabled: false,
            contacts: []
        });

        returnMessage.call(this, "User \"" + username + "\" successfully created");

    } catch(err) {
        returnMessage.call(this, "Error creating user: " + err);
    }

};

const disableUser = async function(username) {

    try {

        // Check to make sure a user is logged in and they're admin and enabled
        await checkAdmin.call(this);

        // Disable that username
        const user = await global.users.findOne({ username: username } );
        await global.users.deleteOne({ username: username } );
        user.disabled = true;
        await global.users.insertOne(user);

        returnMessage.call(this, "User \"" + username + "\" disabled");

    } catch(err) {
        returnMessage.call(this, "Error disabling user: " + err);
    }

};

const getUsers = async function(regex) {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        const userIter = global.users.find({ username: { $regex: regex } });
        const results = [];

        await userIter.forEach((result) => {
            results.push(result.username);
        });

        returnMessage.call(this, {
            type: "UserList",
            users: results
        });

    } catch(err) {
        returnMessage.call(this, "Error searching users: " + err);
    }

};

const addContact = async function(username) {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        if(this.user.contacts.indexOf(username) >= 0)
            throw "This user is already on your contact list";

        const exists = await global.users.findOne({ username: username });

        if(!exists)
            throw "The user \"" + username + "\" does not exist";

        this.user.contacts.push(username);

        //await users.updateOne({ username: this.user.username }, { contacts: this.user.contacts });
        await users.deleteOne({ username: this.user.username } );
        await users.insertOne(this.user);

        returnMessage.call(this, {
            type: "ContactList",
            contacts: this.user.contacts
        });

    } catch(err) {
        returnMessage.call(this, "Error adding contact: " + err)
    }

};

const deleteContact = async function(username) {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        const index = this.user.contacts.indexOf(username);
        if(index < 0)
            throw "This user is not on your contact list";

        this.user.contacts.splice(index, 1);

        //await users.updateOne({ username: this.user.username }, { contacts: this.user.contacts });
        await users.deleteOne({ username: this.user.username } );
        await users.insertOne(this.user);

        returnMessage.call(this, {
            type: "ContactList",
            contacts: this.user.contacts
        });

    } catch(err) {
        returnMessage.call(this, "Error deleting contact: " + err);
    }

};

const getContacts = async function(username) {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        returnMessage.call(this, {
            type: "ContactList",
            contacts: this.user.contacts
        });

    } catch(err) {
        returnMessage.call(this, "Error getting contacts: " + err);
    }

};

const getConversations = async function() {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        const convoIter = this.user.admin ?
            global.conversations.find({ }) :
            global.conversations.find({ users: this.user.username });

        const results = [];

        await convoIter.forEach((convo) => {
            results.push(convo);
        });

        returnMessage.call(this, {
            type: "ConversationList",
            conversations: results
        });

    } catch(err) {
        returnMessage.call(this, "Error getting conversation list: " + err);
    }

};

const newConversation = async function(name, users) {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        // Make sure all users exist and include this user
        for(const user of users) {

            const result = await global.users.findOne({ username: user });

            if(!result)
                throw "User \"" + user + "\" does not exist";

        }

        users.push(this.user.username);

        const convo = new Conversation({
            id: nextConversationID++,
            users: users,
            name: name
        });

        await global.conversations.insertOne({
            id: convo.id,
            users: Array.from(convo.users),
            name: convo.name
        });

        // Notify users of the conversation and admins
        global.sessions.forEach(async function(session, username) {

            if(session.user.admin || (convo.users.has(username)))
                await getConversations.call(session);

        });

    } catch(err) {
        returnMessage.call(this, "Error creating new conversation: " + err);
    }

};

const deleteConversation = async function(id) {

    try {

        // Check to make sure a user is logged in and they're admin and enabled
        await checkAdmin.call(this);

        let convo = await global.conversations.findOneAndDelete({ id: id });

        if(!convo || !(convo.value))
            throw "Couldn't retrieve conversation with that ID from database";

        convo = convo.value;

        // Notify users of the conversation and admins
        global.sessions.forEach(async function(session, username) {

            if(session.user.admin || (convo.users.indexOf(username) >= 0))
                await getConversations.call(session);

        });

        // Delete all messages from that conversation
        await messages.deleteMany({ cid: convo.id });

    } catch(err) {
        returnMessage.call(this, "Error deleting conversation: " + err)
    }

};

const getMessages = async function(cid) {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        // Make sure this user is in this conversation or admin
        const convo = await global.conversations.findOne({ id: cid });

        if(!(this.user.admin) && !(convo.users.indexOf(this.user.username) >= 0))
            throw "You don't have permission to view this conversation";

        // Retrieve messages
        const msgs = [];
        const messageIter = global.messages.find({ cid: cid }, { sort: { timestamp: 1 } });

        await messageIter.forEach((msg) => {
            msgs.push(new Message(msg));
        });

        returnMessage.call(this, {
            type: "MessageList",
            cid: cid,
            messages: msgs
        });

    } catch(err) {
        returnMessage.call(this, "Error retrieving messages: " + err);
    }

};

const sendMessage = async function(cid, text) {

    try {

        // Check to make sure a user is logged in and they're enabled
        await checkLoggedIn.call(this);

        // Make sure this user is in this conversation or admin
        const convo = await global.conversations.findOne({ id: cid });

        if(!(convo.users.indexOf(this.user.username) >= 0))
            throw "You don't have permission to participate in this conversation";

        // Make message
        await global.messages.insertOne({
            id: nextMessageID++,
            cid: cid,
            user: this.user.username,
            text: text,
            timestamp: new Date().getTime()
        });

        // Notify users
        global.sessions.forEach(async function(session, username) {

            if(convo.users.indexOf(username) >= 0)
                await getMessages.call(session, cid);

        });

    } catch(err) {
        returnMessage.call(this, "Error sending message: " + err);
    }

};

const login = async function(username, password) {

    try {

        // Make sure we're not logged in yet
        if(this.user)
            throw "This session is already logged in";

        // Check credentials
        const user = await global.users.findOne({
            username: username,
            password: password
        });

        if(!user)
            throw "No matching username/password combo found";

        // Valid creds were given
        this.user = user;
        global.sessions.set(username, this);

        returnMessage.call(this, "Logged in");

        returnMessage.call(this, {
            type: "ContactList",
            contacts: this.user.contacts
        });

        getConversations.call(this);

    } catch(err) {
        returnMessage.call(this, "Error logging in: " + err);
    }

};

const logout = async function() {

    try {

        // Make sure we're logged in
        if(!this.user)
            throw "This session is not logged in";

        global.sessions.delete(this.user.username);
        this.user = null;

        returnMessage.call(this, "Logged out");

    } catch(err) {
        returnMessage.call(this, "Error logging out: " + err)
    }

};

const processMessage = function(message) {

    let req = JSON.parse(message);

    switch(req.type) {

        case "AddUser":
            addUser.call(this, req.username, req.password, req.admin);
            break;

        case "DisableUser":
            disableUser.call(this, req.username);
            break;

        case "GetUsers":
            getUsers.call(this, req.regex);
            break;

        case "AddContact":
            addContact.call(this, req.username);
            break;

        case "DeleteContact":
            deleteContact.call(this, req.username);
            break;

        case "GetConversations":
            getConversations.call(this);
            break;

        case "NewConversation":
            newConversation.call(this, req.name, req.users);
            break;

        case "DeleteConversation":
            deleteConversation.call(this, req.id);
            break;

        case "GetMessages":
            getMessages.call(this, req.cid);
            break;

        case "SendMessage":
            sendMessage.call(this, req.cid, req.text);
            break;

        case "Login":
            login.call(this, req.username, req.password);
            break;

        case "Logout":
            logout.call(this);
            break;

        default:
            console.log("Unknown request type received: " + req.type);
            break;

    }

};

exports.initializeServer = async function(port, dbUrl) {

    global.server = http.createServer(app);

    global.nextConversationID = 0;
    global.nextMessageID = 0;

    global.sessions = new Map();

    console.log("Connecting to database server \"" + dbUrl + "\"");
    global.db = MongoClient(dbUrl, { useUnifiedTopology: true });

    try {

        await global.db.connect();

        global.users = global.db.db("tima").collection("users");
        global.conversations = global.db.db("tima").collection("conversations");
        global.messages = global.db.db("tima").collection("messages");

        // Find highest message and conversation IDs
        console.log("Connected to DB.  Retrieving message and conversation IDs");
        const highestMessage = await global.messages.findOne({}, { sort: { id: -1 } });
        const highestConversation = await global.conversations.findOne({}, { sort: { id: -1 } });

        if(highestMessage) {

            global.nextMessageID = highestMessage.id + 1;
            console.log("Starting at message ID " + global.nextMessageID);

        }

        if(highestConversation) {

            global.nextConversationID = highestConversation.id + 1
            console.log("Starting at conversation ID " + global.nextConversationID);

        }

        // Start listening for web socket connections
        global.wss = new WebSocket.Server({ server: global.server });

        wss.on("connection", (ws) => {

            ws.isAlive = true;

            ws.on("message", processMessage);

            ws.on("pong", () => {
                ws.isAlive = true;
            });

            returnMessage.call(ws, "Connected to server");

        });
/*
        // Periodically ping connections to make sure they're still live
        // If a connection breaks, end the associated user session (if any)
        setInterval(() => {

            wss.clients.forEach((ws) => {

                if(!ws.isAlive) {

                    if(ws.user)
                        global.sessions.delete(ws.user.username);

                    return ws.terminate();

                }

                ws.isAlive = false;
                ws.ping(null, false, true);

            }, 10000);

        });
*/
        // Serve client
        app.get("/", (req, res) => {
            res.sendFile(__dirname + "/client.html");
        });

        // Listen for incoming HTTP connections
        global.server.listen(port, () => {
            console.log(`Listening at http://localhost:${port}`);
        });

    } catch(err) {
        console.error("Error initializing server: " + err);
    }

};

exports.shutdownServer = async function(httpServer, wsPort, dbUrl) {

    try { await global.db.close(); } catch(err) {}
    try { await global.wss.close(); } catch(err) {}

};
