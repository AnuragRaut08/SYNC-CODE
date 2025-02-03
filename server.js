const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const axios = require("axios");

const ACTIONS = require("./src/actions/Actions");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the React build folder
app.use(express.static("build"));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

const userSocketMap = {};

// Get all connected clients in a room
function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => ({
            socketId,
            username: userSocketMap[socketId],
        })
    );
}

// AI Autocomplete function using Tabby AI
async function getAISuggestions(codeSnippet) {
    try {
        const response = await axios.post("http://localhost:8080/v1/completions", {
            prompt: codeSnippet,
        });
        return response.data.choices[0].text;
    } catch (error) {
        console.error("Error fetching AI suggestions:", error);
        return "";
    }
}

// WebSocket connection handler
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Handle user joining a room
    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);

        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    // Handle real-time code changes
    socket.on(ACTIONS.CODE_CHANGE, async ({ roomId, code }) => {
        // Get AI suggestions and send them along with code
        const aiSuggestion = await getAISuggestions(code);
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code, aiSuggestion });
    });

    // Handle code sync for new users
    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // Handle user disconnecting
    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

// Serve response in production
app.get("/", (req, res) => {
    res.send("<h1>Welcome to the AI-assisted real-time code editor</h1>");
});

// Start server
const PORT = process.env.SERVER_PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
