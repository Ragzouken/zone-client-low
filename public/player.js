import { html } from "utility";

export class Player {
    constructor() {
        this.videoElement = html("video");
        this.sourceElement = html("source");
        this.trackElement = html("track", { kind: "subtitles", label: "english" });
    }

    /**
     * @param {string} [src]
     */
    setSource(src) {
        this.videoElement.removeAttribute("poster");

        if (!src) {
            this.sourceElement.removeAttribute("src");
            this.sourceElement.remove();
            this.videoElement.load();
            this.setSubtitles();
        } else {
            this.sourceElement.setAttribute("src", src);
            this.videoElement.append(this.sourceElement);            
            
            if (src.endsWith(".mp3")) {
                this.videoElement.setAttribute("poster", "./audio-logo.png");
            }
        }
    }

    /**
     * @param {string} [src]
     */
    setSubtitles(src) {
        if (!src) {
            this.trackElement.removeAttribute("src");
            this.trackElement.remove();
        } else {
            this.trackElement.setAttribute("src", src);
            this.videoElement.append(this.trackElement);
            this.videoElement.textTracks[0].mode = 'showing';
        }
    }
}
