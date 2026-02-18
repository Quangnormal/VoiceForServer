const socket = io();
let localStream;
let peers = {};
let micEnabled = true;

async function join() {
    const username = document.getElementById("username").value;
    if (!username) return alert("Enter username");

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    socket.emit("join", username);
}

function toggleMic() {
    if (!localStream) return;
    micEnabled = !micEnabled;
    localStream.getAudioTracks()[0].enabled = micEnabled;
}

socket.on("users", async (users) => {
    const list = document.getElementById("users");
    list.innerHTML = "";

    for (let id in users) {
        const li = document.createElement("li");
        li.innerText = users[id];
        list.appendChild(li);

        if (id !== socket.id && !peers[id]) {
            createPeer(id, true);
        }
    }
});

socket.on("signal", async (data) => {
    if (!peers[data.from]) {
        createPeer(data.from, false);
    }
    await peers[data.from].setRemoteDescription(new RTCSessionDescription(data.signal));

    if (data.signal.type === "offer") {
        const answer = await peers[data.from].createAnswer();
        await peers[data.from].setLocalDescription(answer);
        socket.emit("signal", { to: data.from, signal: answer });
    }
});

function createPeer(id, initiator) {
    const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });

    peer.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("signal", {
                to: id,
                signal: event.candidate
            });
        }
    };

    peer.ontrack = event => {
        const audio = document.createElement("audio");
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
    };

    if (initiator) {
        peer.createOffer().then(offer => {
            peer.setLocalDescription(offer);
            socket.emit("signal", { to: id, signal: offer });
        });
    }

    peers[id] = peer;
}
