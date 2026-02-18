const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {};

io.on("connection", (socket) => {

  socket.on("join", (username) => {
    users[socket.id] = username;

    socket.emit("existing-users",
      Object.keys(users).filter(id => id !== socket.id)
    );

    socket.broadcast.emit("user-joined", socket.id);

    io.emit("update-users", users);
  });

  socket.on("offer", (data) => {
    io.to(data.to).emit("offer", {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on("ice-candidate", (data) => {
    io.to(data.to).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    socket.broadcast.emit("user-left", socket.id);
    io.emit("update-users", users);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
