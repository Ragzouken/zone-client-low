import { HSVToRGB, createRendering2D, hexToUint32, rgbToHex } from "blitsy";
import { ZoneClient } from "client";
import { ONE, ALL, html, sleep } from "utility"; 
import { Player } from "player";

let localName = localStorage.getItem("name") || "zone-mobile-test";
let localAvatar = 
    localStorage.getItem(localStorage.getItem('avatar-slot-active') ?? 'a') 
    || localStorage.getItem('avatar')
    || "GBgYPH69JCQ=";

let lastPlay;

function setCurrentItem(player, item, time) {
    lastPlay = { timestamp: performance.now(), time, item };
    updatePlayer(player);
}

/**
 * @param {Player} player
 */
function updatePlayer(player) {
    if (!lastPlay) {
        player.setState();
        player.videoElement.poster = "zone-logo.png";
        return;
    } else {
        const elapsed = performance.now() - lastPlay.timestamp;
        const time = (lastPlay.time + elapsed) / 1000;
        const { src, subtitle } = lastPlay.item.media;

        player.setState({ src, subtitle, time });    
    }
}

/**
 * @param {string} text
 */
function textToYoutubeVideoId(text) {
    text = text.trim();
    if (text.length === 11) return text;
    return new URL(text).searchParams.get('v');
}

export async function start() {
    setupEntrySplash();
}

function colorText(text, color) {
    return html("span", { style: `color: ${color}` }, text);
}

function createSpaceElement(width) {
    return html("span", { style: `display: inline-block; width: ${width}px` });
}

function createUserElement(user) {
    const name = colorText(user.name ?? "anonymous", getUserColor(user.userId ?? 0));
    const avatar = createAvatarElement(user.avatar || 'GBgYPH69JCQ=');
    return html("div", {}, name, createSpaceElement(8), avatar);
}

function createAvatarElement(avatar, color = "#ffffff") {
    const src = decodeTile(avatar, color).canvas.toDataURL();
    const img = html("img", { class: "chat-avatar pixelated", src });
    return img;
}

function setupEntrySplash() {
    const nameInput = /** @type {HTMLInputElement} */ (document.getElementById('entry-name'));
    const entrySplash = /** @type {HTMLElement} */ (document.getElementById('entry-splash'));
    const entryUsers = /** @type {HTMLElement} */ (document.getElementById('entry-users'));
    const entryButton = /** @type {HTMLInputElement} */ (document.getElementById('entry-button'));
    const entryForm = /** @type {HTMLFormElement} */ (document.getElementById('entry-form'));

    function updateEntryUsers() {
        if (entrySplash.hidden) return;

        fetch('https://tinybird.zone/users')
            .then((res) => res.json())
            .then((users) => {
                if (users.length === 0) {
                    entryUsers.replaceChildren("zone is currenty empty");
                } else {
                    entryUsers.replaceChildren(...users.map(createUserElement));
                }
            });
    }
    updateEntryUsers();
    const interval = setInterval(updateEntryUsers, 5000);

    nameInput.value = localName;
    entryButton.disabled = !entryForm.checkValidity();
    nameInput.addEventListener('input', () => (entryButton.disabled = !entryForm.checkValidity()));

    entryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const audio = html("audio", { src: "./buddy-in.mp3", hidden: true });
        document.body.append(audio);
        audio.play();

        entrySplash.hidden = true;
        clearInterval(interval);

        window.dispatchEvent(new Event('resize')); // trigger a resize to update renderer
        localName = nameInput.value;
        localStorage.setItem('name', localName);
        await login();
    });
}

async function login() {
    const client = new ZoneClient("https://tinybird.zone/");
    const player = new Player({ root: "https://tinybird.zone" });

    ONE("#scene").append(player.videoElement);

    const log = ONE("#chat-log");
    const chatInput = /** @type {HTMLInputElement} */ (ONE("#chat-text"));

    ONE("#chat-input").addEventListener("submit", (event) => {
        event.preventDefault();
        sendChat();
    });

    // ONE("#video-tab").addEventListener("click", (event) => {
    //     ONE("#video-tab").remove();
    //     openVideoTab();
    // });

    const chatCommands = new Map();
    chatCommands.set("name", rename);
    chatCommands.set("avatar", avatar);
    chatCommands.set("skip", skip);
    chatCommands.set('youtube', (args) => client.queue("youtube:" + textToYoutubeVideoId(args)));
    chatCommands.set("search", (query) => chatSearch("youtube", query));
    chatCommands.set("library", (query) => chatSearch("library", query));
    chatCommands.set('result', playFromSearchResult);
    chatCommands.set("banger", (tag) => client.banger(tag))

    chatCommands.set("queue", () => {
        const queue = [client.zone.lastPlayedItem, ...client.zone.queue];

        for (const item of queue) {
            if (!item) continue;
            logChat(`[${item.itemId}] ${item.media.title} (${secondsToTime(item.media.duration/1000)})`);
        }
    });

    chatCommands.set('l', chatCommands.get('library'));
    chatCommands.set('s', chatCommands.get('search'));
    chatCommands.set('r', chatCommands.get('result'));
    chatCommands.set('q', chatCommands.get('queue'));

    let lastSearchResults = [];

    async function playFromSearchResult(args) {
        const index = parseInt(args, 10) - 1;
        const results = lastSearchResults;

        if (isNaN(index)) logStatus(colorText(`did not understand '${args}' as a number`, "#ff00ff"));
        else if (!results || index < 0 || index >= results.length)
            logStatus(colorText(`there is no #${index + 1} search result`, "#ff00ff"));
        else return client.queue(results[index].path);
    }

    /**
     * @param {string} library
     * @param {string} [query]
     * @param {string} [tag]
     */
    async function chatSearch(library, query = undefined, tag = undefined) {
        lastSearchResults = await client.searchLibrary(library, query, tag);
        const lines = lastSearchResults
            .slice(0, 5)
            .map(({ title, duration }, i) => `${i + 1}. ${title} (${secondsToTime(duration / 1000)})`);
        
        logChat(colorText("? queue Search result with /result n", "#ffff00"));
        for (const line of lines) {
            logChat(colorText(line, "#00FFFF"));
        }
    }

    function rename(name) {
        localStorage.setItem('name', name);
        localName = name;
        client.rename(name);
    }

    function avatar(data) {
        localStorage.setItem("a", data);
    }

    function skip() {
        client.skip();
    }

    function sendChat() {
        const line = chatInput.value;
        const slash = line.match(/^\/([^\s]+)\s*(.*)/);

        if (slash) {
            const command = chatCommands.get(slash[1]);
            if (command) {
                const promise = command(slash[2].trim());
                if (promise) promise.catch((error) => logStatus(colorText(`${line} failed: ${error.message}`, "#ff00ff")));
            } else {
                logStatus(colorText(`no command /${slash[1]}`, "#ff00ff"));
            }
        } else if (line.length > 0) {
            client.chat(parseFakedown(line));
        }

        chatInput.value = '';
    }

    function username(user) {
        const color = getUserColor(user.userId);
        
        return [
            colorText(user.name, color), 
            createSpaceElement(8), 
            createAvatarElement(user.avatar, color),
        ];
    }

    const fadeAnim = [
        { opacity: 1 },
        { opacity: 0 },
    ];

    function logChat(...elements) {
        const root = html("div", { class: "chat-message" }, ...elements);
        const anim = root.animate(fadeAnim, { duration: 1000, delay: 30 * 1000 });
        anim.addEventListener("finish", () => root.remove());

        log.append(root);
        root.scrollIntoView();
        return root;
    }

    function logStatus(...elements) {
        logChat(
            colorText("! ", "#ff00ff"),
            ...elements
        );
    }

    function logJoin(user) {
        logStatus(
            ...username(user),
            colorText("joined", "#ff00ff"),
        );
    }

    client.on("join", (data) => {
        logJoin(data.user);
    });

    client.on('disconnect', async ({ clean }) => {
        if (clean) return;
        logChat(colorText("*** disconnected ***", "#ff0000"));
        await sleep(1000);
        await connect();
    });

    client.on("chat", (data) => {
        logChat(
            ...username(data.user),
            createSpaceElement(8),
            data.text,
        );
    });

    client.on("rename", (data) => {
        if (data.local) {
            logStatus(colorText("you are ", "#ff00ff"), ...username(data.user));
        } else {
            logStatus(colorText(data.previous, getUserColor(data.user.userId)), colorText(" is now ", "#ff00ff"), ...username(data.user));
        }
    });

    client.on('leave', (event) => logStatus(...username(event.user), colorText("left", "#ff00ff")));
    client.on('status', (event) => logStatus(colorText(event.text, "#ff00ff")));

    client.on('queue', ({ item }) => {
        const { title, duration } = item.media;
        const user = item.info.userId ? client.zone.users.get(item.info.userId) : undefined;
        const usern = user ? username(user) : ['server'];
        const time = secondsToTime(duration / 1000);
        if (item.info.banger) {
            logChat(
                colorText(`+ ${title} (${time}) rolled from `, "#00ffff"),
                colorText("bangers", "#ff00ff"),
                colorText(" by ", "#00ffff"),
                ...usern,
            );
        } else {
            logChat(
                colorText(`+ ${title} (${time}) added by `, "#00ffff"),
                ...usern,
            );
        }

        // refreshQueue();
    });
    client.on('unqueue', ({ item }) => {
        logChat(colorText(`- ${item.media.title} unqueued`, "#008888"));
        // refreshQueue();
    });

    client.on('play', async ({ message: { item, time } }) => {
        if (!item) {
            // player.stopPlaying();
            lastPlay = undefined;
            updatePlayer(player);
        } else {
            // player.setPlaying(item, time || 0);

            const { title, duration } = item.media;
            const t = secondsToTime(duration / 1000);
            logChat(
                colorText(`> ${title} (${t})`, "#00ffff"),
            );

            setCurrentItem(player, item, time);
        }
    });

    async function connect() {
        try {
            await client.join({ name: localName, avatar: localAvatar });
        } catch (e) {
            await sleep(500);
            return connect();
        }
    
        // reload page after 2 hours of idling
        detectIdle(2 * 60 * 60 * 1000).then(() => {
            client.messaging.close();
            //location.reload();
        });

        const users = [];
        Array.from(client.zone.users).forEach(([, user]) => {
            users.push(...username(user));
            users.push(colorText(", ", "#ff00ff"));
        });
        users.pop();

        logChat(colorText("*** connected ***", "#00ff00"));
        logChat(colorText(`${client.zone.users.size} users: `, "#ff00ff"), ...users);
    }

    connect();
}

async function detectIdle(limit) {
    return new Promise((resolve, reject) => {
        let t = 0;
        window.addEventListener('pointermove', resetTimer);
        window.addEventListener('keydown', resetTimer);

        function resetTimer() {
            clearTimeout(t);
            t = window.setTimeout(resolve, limit);
        }
    });
}

function decodeTile(data, color) {
    const rendering = createRendering2D(8, 8);
    const image = rendering.getImageData(0, 0, 8, 8);
    decodeM1(base64ToUint8(data), image.data, hexToUint32(color));
    rendering.putImageData(image, 0, 0);
    return rendering;
}

var WHITE = 0xffffffff;
var CLEAR = 0x00000000;
function decodeM1(data, pixels, white = WHITE, clear = CLEAR) {
    var pixels32 = new Uint32Array(pixels.buffer);
    for (var i = 0; i < data.length; ++i) {
        for (var bit = 0; bit < 8; ++bit) {
            if (i * 8 + bit < pixels32.length) {
                var on = (data[i] >> bit) & 1;
                pixels32[i * 8 + bit] = on ? white : clear;
            }
        }
    }
};
function encodeM1(pixels) {
    var pixels32 = new Uint32Array(pixels.buffer);
    var data = new Uint8ClampedArray(Math.ceil(pixels32.length / 8));
    for (var i = 0; i < data.length; ++i) {
        var byte = 0;
        for (var bit = 0; bit < 8; ++bit) {
            byte <<= 1;
            byte |= pixels32[i * 8 + (7 - bit)] > 0 ? 1 : 0;
        }
        data[i] = byte;
    }
    return data;
};
function base64ToUint8(base64) {
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8ClampedArray(new ArrayBuffer(rawLength));
    for (var i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}
function uint8ToBase64(u8Arr) {
    var CHUNK_SIZE = 0x8000; // arbitrary number
    var index = 0;
    var length = u8Arr.length;
    var result = '';
    while (index < length) {
        var slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }
    return btoa(result);
}

let hsl2hsv = (h,s,l,v=s*Math.min(l,1-l)+l) => [h, v?2-2*l/v:0, v];

const colorCount = 16;
const colors = [];
for (let i = 0; i < colorCount; ++i) {
    const [h, s, v] = hsl2hsv(i / colorCount, 1, .65);
    const color = rgbToHex(HSVToRGB({ h, s, v }));
    colors.push(color);
}

function getUserColor(userId) {
    const i = parseInt(userId, 10) % colors.length;
    const color = colors[i];
    return color;
}

const pad2 = (part) => (part.toString().length >= 2 ? part.toString() : '0' + part.toString());
function secondsToTime(seconds) {
    if (isNaN(seconds)) return '??:??';

    const s = Math.floor(seconds % 60);
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);

    return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

function parseFakedown(text) {
    text = fakedownToTag(text, '##', 'shk');
    text = fakedownToTag(text, '~~', 'wvy');
    text = fakedownToTag(text, '==', 'rbw');
    return text;
}

function fakedownToTag(text, fd, tag) {
    const pattern = new RegExp(`${fd}([^${fd}]+)${fd}`, 'g');
    return text.replace(pattern, `{+${tag}}$1{-${tag}}`);
}
