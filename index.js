"use strict";

var os = require("os");
var nodeStatic = require("node-static");
var http = require("http");
var socketIO = require("socket.io");
var PORT = process.env.PORT || 3000;

var fileServer = new nodeStatic.Server();
var app = http
  .createServer(function(req, res) {
    fileServer.serve(req, res);
  })
  .listen(PORT, function() {
    console.log("Sever started");
  });

var io = socketIO.listen(app);
let sockets = {};
io.sockets.on("connection", function(socket) {
  // convenience function to log server messages on the client

  console.log("total users", Object.keys(io.sockets.sockets).length);

  function log() {
    var array = ["Message from server:"];
    array.push.apply(array, arguments);
    socket.emit("log", array);
  }

  socket.on("username", username => {
    socket.username = username;
    sockets[username] = socket;
  });

  socket.on("call", data => {
    let { description, username } = data;
    let remoteUserSocket = sockets[username];
    if (remoteUserSocket) {
      remoteUserSocket.emit("incomingCall", {
        description,
        username: socket.username
      });
    } else {
      log("user not connected");
    }
  });

  socket.on("addCandidate", iceCandidate => {
    if (sockets[iceCandidate.username])
      sockets[iceCandidate.username].emit("remoteICECandidate", iceCandidate);
    else console.log("no user to send ice data", sockets);
  });

  socket.on("acceptCall", data => {
    let { description, username } = data;
    let remoteUserSocket = sockets[username];
    if (remoteUserSocket) {
      remoteUserSocket.emit("callAnswered", {
        description,
        username: socket.username
      });
    } else {
      log("user not connected");
    }
  });

  socket.on("message", function(message) {
    log("Client said: ", message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit("message", message);
  });

  socket.on("create or join", function(room) {
    log("Received request to create or join room " + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom
      ? Object.keys(clientsInRoom.sockets).length
      : 0;
    log("Room " + room + " now has " + numClients + " client(s)");

    if (numClients === 0) {
      socket.join(room);
      log("Client ID " + socket.id + " created room " + room);
      socket.emit("created", room, socket.id);
    } else if (numClients === 1) {
      log("Client ID " + socket.id + " joined room " + room);
      io.sockets.in(room).emit("join", room);
      socket.join(room);
      socket.emit("joined", room, socket.id);
      io.sockets.in(room).emit("ready");
    } else {
      // max two clients
      socket.emit("full", room);
    }
  });

  socket.on("ipaddr", function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === "IPv4" && details.address !== "127.0.0.1") {
          socket.emit("ipaddr", details.address);
        }
      });
    }
  });

  socket.on("bye", function() {
    console.log("received bye");
  });
});
