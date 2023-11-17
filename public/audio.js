import { html } from "utility";

export function playClip(src) {
    const audio = html("audio", { src, hidden: true });
    document.body.append(audio);
    audio.addEventListener("ended", () => audio.remove());
    audio.play();
}
