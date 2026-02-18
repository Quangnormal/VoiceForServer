const socket = io();
let localStream;
let peers = {};

async function join() {
  const username = document.getElementById("username").value;
  if (!username) return;

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  socket.emit("join", username);
}

function createPeerConnection(id) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        candidate: event.candidate,
        to: id
      });
    }
  };

  pc.ontrack = event => {
    const audio = document.createElement("audio");
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  return pc;
}

/* ===== Khi join sẽ nhận danh sách user đã có ===== */
socket.on("existing-users", async (users) => {
  for (let id of users) {
    const pc = createPeerConnection(id);
    peers[id] = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
      offer: offer,
      to: id
    });
  }
});

/* ===== Khi có user mới vào ===== */
socket.on("user-joined", async (id) => {
  const pc = createPeerConnection(id);
  peers[id] = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", {
    offer: offer,
    to: id
  });
});

/* ===== Khi nhận offer ===== */
socket.on("offer", async ({ offer, from }) => {
  const pc = createPeerConnection(from);
  peers[from] = pc;

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", {
    answer: answer,
    to: from
  });
});

/* ===== Khi nhận answer ===== */
socket.on("answer", async ({ answer, from }) => {
  if (!answer) return;

  const pc = peers[from];
  if (!pc) return;

  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

/* ===== ICE ===== */
socket.on("ice-candidate", async ({ candidate, from }) => {
  const pc = peers[from];
  if (!pc) return;

  if (candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

/* ===== User rời ===== */
socket.on("user-left", (id) => {
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
  }
});

/* ===== Toggle Mic ===== */
function toggleMic() {
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !track.enabled;
  });
}

/* ===== Update user list ===== */
socket.on("update-users", (users) => {
  const list = document.getElementById("users");
  list.innerHTML = "";

  Object.values(users).forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    list.appendChild(li);
  });
});
