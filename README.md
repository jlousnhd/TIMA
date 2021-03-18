TIMA:  The Instant Messenger App
--------------------------------
This is a simple instant messenger platform designed to be run on a server using
Node.js, MongoDB, Express.js and React.js.

Running Instructions
--------------------
Ensure that Express.js, React.js and MongoDB and the WebSocket library are
installed in the current directory:

    npm install express react mongodb ws

Next, run the app:

    node tima.js [database]

[database] is an optional argument with a database server host and port.  It
defaults to "localhost:27017".  The app is accessible on the localhost at port
80.
