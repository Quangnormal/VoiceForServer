const socket = io();
let localStream;
let peers = {};
let isMakingOffer = {};
let polite = {};

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

  peers[id] = pc;
  isMakingOffer[id] = false;

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice-candidate", {
        to: id,
        candidate: e.candidate
      });
    }
  };

  pc.ontrack = e => {
    const audio = document.createElement("audio");
    audio.srcObject = e.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  return pc;
}

/* ===== Khi có user mới ===== */
socket.on("user-joined", async (id) => {
  polite[id] = false; // người cũ chủ động tạo offer
  const pc = createPeerConnection(id);

  try {
    isMakingOffer[id] = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
      to: id,
      offer: pc.localDescription
    });
  } finally {
    isMakingOffer[id] = false;
  }
});

/* ===== Khi nhận offer ===== */
socket.on("offer", async ({ offer, from }) => {
  polite[from] = true; // người vào sau sẽ polite

  let pc = peers[from];
  if (!pc) pc = createPeerConnection(from);

  const readyForOffer =
    !isMakingOffer[from] &&
    (pc.signalingState === "stable" || pc.signalingState === "have-local-offer");

  if (!readyForOffer) return;

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", {
    to: from,
    answer: pc.localDescription
  });
});

/* ===== Khi nhận answer ===== */
socket.on("answer", async ({ answer, from }) => {
  const pc = peers[from];
  if (!pc) return;

  if (pc.signalingState !== "have-local-offer") return;

  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

/* ===== ICE ===== */
socket.on("ice-candidate", async ({ candidate, from }) => {
  const pc = peers[from];
  if (!pc) return;

  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {}
});

/* ===== User rời ===== */
socket.on("user-left", (id) => {
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
  }
});

/* ===== Toggle mic ===== */
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
