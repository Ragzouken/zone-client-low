import { html } from "utility";

/** @param {string} [src] */
const isAudio = (src) => src?.endsWith(".mp3");

export class Player {
    /**
     * @param {Object} options
     */
    constructor({} = {}) {
        this.videoElement = html("video", { muted: true });
        this.sourceElement = html("source");
        this.trackElement = html("track", { kind: "subtitles", label: "english" });
    }

    /**
     * @param {Object} [state]
     * @param {string} [state.src]
     * @param {string} [state.subtitle]
     * @param {number} [state.time]
     */
    setState({ src, subtitle, time } = {}) {
        this.setSource(src)
        this.setSubtitle(subtitle);
        this.setTime(time);
    }

    /**
     * @param {number} time
     */
    setTime(time = 0) {
        this.videoElement.currentTime = time;
        this.videoElement.play().catch(() => {});
    }

    /**
     * @param {string} [src]
     */
    setSource(src) {
        this.setPoster(isAudio(src) ? "./audio-logo.png" : "./zone-logo.png");

        if (!src) {
            this.sourceElement.removeAttribute("src");
            this.sourceElement.remove();
            this.videoElement.load();
        } else if (src !== this.videoElement.currentSrc) {
            this.sourceElement.setAttribute("src", src);
            this.videoElement.append(this.sourceElement);
        }
    }

    /**
     * @param {string} [src]
     */
    setPoster(src) {
        if (src) {
            this.videoElement.setAttribute("poster", src);
        } else {
            this.videoElement.removeAttribute("poster");
        }
    }

    /**
     * @param {string} [src]
     */
    setSubtitle(src) {
        if (!src) {
            this.trackElement.removeAttribute("src");
            this.trackElement.remove();
        } else {
            const url = new URL(src);
            url.searchParams.set("v", Math.random().toString());

            this.trackElement.setAttribute("src", url.toString());
            this.videoElement.append(this.trackElement);
            this.videoElement.textTracks[0].mode = 'showing';
        }
    }
}
