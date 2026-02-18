const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {};

io.on("connection", (socket) => {

    socket.on("join", (username) => {
        users[socket.id] = username;
        io.emit("users", users);
    });

    socket.on("signal", (data) => {
        io.to(data.to).emit("signal", {
            from: socket.id,
            signal: data.signal
        });
    });

    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("users", users);
    });

});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
