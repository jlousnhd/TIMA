const tima = require("./tima-server");

let dbhost = "localhost:27017";

if(process.argv.length >= 3)
    dbhost = process.argv[2];

tima.initializeServer(80, "mongodb://" + dbhost + "/tima");
