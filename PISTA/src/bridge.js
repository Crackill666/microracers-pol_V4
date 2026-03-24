export function getQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    embed: params.get("embed") === "1",
    car: params.get("car") || "",
    track: params.get("track") || "random",
    limit: Number(params.get("limit") || 45),
    seed: Number(params.get("seed") || Math.floor(Math.random() * 1000000)),
  };
}

function postToParent(payload) {
  const eventPayload = {
    ...payload,
    __eventId: `${payload.type}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    __eventTs: Date.now(),
  };

  try {
    window.localStorage.setItem("MICRORACERS_TIME_TRIAL_EVENT_V1", JSON.stringify(eventPayload));
  } catch {}

  try {
    if (
      window.opener &&
      !window.opener.closed &&
      typeof window.opener.__MICRORACERS_TIME_TRIAL_EVENT__ === "function"
    ) {
      window.opener.__MICRORACERS_TIME_TRIAL_EVENT__(eventPayload);
      return;
    }
  } catch {}

  try {
    if (
      window.parent &&
      window.parent !== window &&
      typeof window.parent.__MICRORACERS_TIME_TRIAL_EVENT__ === "function"
    ) {
      window.parent.__MICRORACERS_TIME_TRIAL_EVENT__(eventPayload);
      return;
    }
  } catch {}

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(eventPayload, "*");
      return;
    }
  } catch {}

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(eventPayload, "*");
    }
  } catch {}
}

export class Bridge {
  constructor(query) {
    this.query = query;
    this.inputEnabled = true;
    this.onReset = null;
    this.onInput = null;
    this.onStart = null;

    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "MICRORACERS_TIME_TRIAL_RESET" && this.onReset) {
        this.onReset();
        return;
      }

      if (data.type === "MICRORACERS_TIME_TRIAL_START" && this.onStart) {
        this.onStart();
        return;
      }

      if (data.type === "MICRORACERS_TIME_TRIAL_INPUT") {
        this.inputEnabled = !!data.enabled;
        if (this.onInput) this.onInput(this.inputEnabled);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        postToParent({ type: "MICRORACERS_TIME_TRIAL_HIDDEN" });
      }
    });
  }

  sendReady(track) {
    postToParent({
      type: "MICRORACERS_TIME_TRIAL_READY",
      car: this.query.car,
      track: track.id,
      seed: this.query.seed,
      limit: this.query.limit,
      parTime: track.parTime,
    });
  }

  sendDone(result) {
    postToParent({
      type: "MICRORACERS_TIME_TRIAL_DONE",
      car: this.query.car,
      track: result.trackId,
      seed: this.query.seed,
      limit: this.query.limit,
      timeSec: result.timeSec,
      hits: result.hits,
      checkpoints: result.checkpoints,
      position: result.position,
    });
  }

  sendSubmit(result) {
    postToParent({
      type: "MICRORACERS_TIME_TRIAL_SUBMIT",
      car: this.query.car,
      track: result.trackId,
      seed: this.query.seed,
      limit: this.query.limit,
      timeSec: result.timeSec,
      hits: result.hits,
      checkpoints: result.checkpoints,
      position: result.position,
    });
  }

  sendClose() {
    postToParent({
      type: "MICRORACERS_TIME_TRIAL_CLOSE",
      car: this.query.car,
      track: this.query.track,
      seed: this.query.seed,
    });
  }
}
