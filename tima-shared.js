(function(exports){

    // User constructor
    exports.User = function(args) {

        if(typeof args.username !== "string")
            throw "No username string provided";

        if(typeof args.admin !== "boolean")
            throw "No admin boolean provided";

        if(typeof args.disabled !== "boolean")
            throw "No disabled boolean provided";

        if(typeof args.password !== "string")
            throw "No password string provided";

        if(!Array.isArray(args.contacts))
            throw "No contacts array provided";

        for(const contact of args.contacts)
            if(typeof contact !== "string")
                throw "Contacts array contains non-string object";

        this.username = args.username;
        this.admin = args.admin;
        this.disabled = args.disabled;
        this.password = args.password;
        this.contacts = new Set(args.contacts);

        Object.freeze(this);

    };

    // Conversation constructor
    exports.Conversation = function(args) {

        if(typeof args.id !== "number")
            throw "No ID number provided";

        if(typeof args.name !== "string" || typeof args.name !== "undefined" || args.name != null)
            throw "Name provided is not a string";

        if(!Array.isArray(args.users))
            throw "No users array provided";

        for(const user of args.users)
            if(typeof user !== "string")
                throw "Users array contains non-string object";

        this.id = args.id;

        if(typeof args.name !== "undefined")
            this.name = args.name;

        this.users = new Set(args.users);

        if(this.users.size < 2)
            throw "Users array must contain at least 2 unique usernames";

        Object.freeze(this);

    };

    // Message constructor
    exports.Message = function(args) {

        if(typeof args.id !== "number")
            throw "No ID number provided";

        if(typeof args.cid !== "number")
            throw "No CID number provided";

        if(typeof args.user !== "string")
            throw "No user string provided";

        if(typeof args.text !== "string")
            throw "No text string provided";

        if(typeof args.timestamp !== "number")
            throw "No timestamp number provided";

        this.id = args.id;
        this.cid = args.cid;
        this.user = args.user;
        this.text = args.text;
        this.timestamp = args.timestamp;

        Object.freeze(this);

    };

    // User functions

    exports.User.prototype.copyForUser = function() {

        return new User({
            username: this.username,
            admin: this.admin,
            disabled: this.disabled,
            password: "",
            contacts: [...(this.contacts)]
        });

    };

    exports.User.prototype.copyForOthers = function() {

        return new User({
            username: this.username,
            admin: this.admin,
            disabled: this.disabled,
            password: "",
            contacts: []
        });

    };

    // Conversation functions

    exports.Conversation.prototype.getTitle = function(contextUser) {

        if(this.name)
            return this.name;

        let title = "";

        for(const user of users)
            if(user !== contextUser)
                title = (title.length > 0) ? (title + ", " + user) : user;

        return title;

    };

    // Message functions

    exports.Message.prototype.toCurrentTime = function() {

        return new Message({
            id: this.id,
            cid: this.cid,
            user: this.user,
            text: this.text,
            timestamp: new Date().getTime()
        });

    };

} (typeof exports === 'undefined' ? this.TIMA = {} : exports));
