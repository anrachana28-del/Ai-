const socketIo = require("socket.io");

let io;
let client;

function init(server) {
    io = socketIo(server, {
        cors: { origin: "*" }
    });

    io.on("connection", (socket) => {
        client = socket;
    });
}

function progress(step, msg) {
    if (client) {
        client.emit("progress", { step, msg });
    }
}

module.exports = { init, progress };
