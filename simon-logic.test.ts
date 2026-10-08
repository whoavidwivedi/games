import { describe, expect, test } from "bun:test"

import { stubMathRandom } from "@/test-helpers"

import {
  PADS,
  WIN_LEN,
  freshGame,
  initialState,
  reducer,
  type Phase,
  type State,
} from "@/lib/game-simon"

stubMathRandom()

function runningState(
  seq: number[],
  phase: Phase = "show",
  showPos = 0,
  inputIdx = 0,
  score = 0
): State {
  return { seq, phase, showPos, inputIdx, score, status: "running" }
}

describe("lifecycle", () => {
  test("initial state is idle", () => {
    expect(initialState.status).toBe("idle")
    expect(initialState.seq).toHaveLength(1)
    expect(initialState.phase).toBe("show")
    expect(initialState.score).toBe(0)
  })

  test("toggle starts, pauses, resumes, and restarts", () => {
    const running = reducer(initialState, { type: "toggle" })
    expect(running.status).toBe("running")
    expect(reducer(running, { type: "toggle" }).status).toBe("paused")
    expect(
      reducer({ ...running, status: "paused" }, { type: "toggle" }).status
    ).toBe("running")

    const over: State = { ...freshGame(), status: "over", score: 5 }
    const restarted = reducer(over, { type: "toggle" })
    expect(restarted.status).toBe("running")
    expect(restarted.score).toBe(0)
    expect(restarted.seq).toHaveLength(1)
  })

  test("begin deals a single pad within range from idle", () => {
    const started = reducer(initialState, { type: "begin" })
    expect(started.status).toBe("running")
    expect(started.seq).toHaveLength(1)
    expect(started.seq[0]).toBeGreaterThanOrEqual(0)
    expect(started.seq[0]).toBeLessThan(PADS)
    expect(started.phase).toBe("show")
    expect(started.score).toBe(0)
  })

  test("begin after a loss is a rematch with a fresh sequence", () => {
    const over: State = { ...freshGame(), status: "over", score: 4 }
    const again = reducer(over, { type: "begin" })
    expect(again.status).toBe("running")
    expect(again.score).toBe(0)
    expect(again.seq).toHaveLength(1)
  })
})

describe("step", () => {
  test("steps advance the lit pad, then hand over to input", () => {
    let state = runningState([0, 1, 2])
    state = reducer(state, { type: "step" })
    expect(state.showPos).toBe(1)
    expect(state.phase).toBe("show")

    state = reducer(state, { type: "step" })
    expect(state.showPos).toBe(2)
    expect(state.phase).toBe("show")

    state = reducer(state, { type: "step" })
    expect(state.showPos).toBe(3)
    expect(state.phase).toBe("input")
    expect(state.inputIdx).toBe(0)
  })

  test("a single-pad sequence needs exactly one step", () => {
    const after = reducer(runningState([2]), { type: "step" })
    expect(after.phase).toBe("input")
    expect(after.showPos).toBe(1)
  })

  test("step is a no-op outside the show phase", () => {
    const inInput: State = { ...runningState([0, 1], "input", 2), inputIdx: 1 }
    expect(reducer(inInput, { type: "step" })).toBe(inInput)
    const paused: State = { ...inInput, status: "paused" }
    expect(reducer(paused, { type: "step" })).toBe(paused)
    const over: State = { ...inInput, status: "over" }
    expect(reducer(over, { type: "step" })).toBe(over)
  })
})

describe("press", () => {
  test("the right pad advances input and grows the sequence on completion", () => {
    const inInput: State = { ...runningState([0, 1], "input", 2), inputIdx: 0 }
    const one = reducer(inInput, { type: "press", pad: 0 })
    expect(one.status).toBe("running")
    expect(one.inputIdx).toBe(1)

    const done = reducer(one, { type: "press", pad: 1 })
    expect(done.seq.length).toBe(3)
    expect(done.seq.slice(0, 2)).toEqual([0, 1])
    expect(done.seq[2]).toBeGreaterThanOrEqual(0)
    expect(done.seq[2]).toBeLessThan(PADS)
    expect(done.phase).toBe("show")
    expect(done.showPos).toBe(0)
    expect(done.inputIdx).toBe(0)
    expect(done.score).toBe(2)
  })

  test("a wrong pad ends the run at the completed score", () => {
    const inInput: State = { ...runningState([0, 1, 2], "input", 3), inputIdx: 0 }
    const over = reducer(inInput, { type: "press", pad: 1 })
    expect(over.status).toBe("over")
    expect(over.score).toBe(2) // rounds of lengths 1 and 2 were completed
  })

  test("press is ignored during show, pause, and over", () => {
    const show = runningState([0, 1])
    expect(reducer(show, { type: "press", pad: 9 })).toBe(show)
    const paused: State = { ...show, status: "paused" }
    expect(reducer(paused, { type: "press", pad: 0 })).toBe(paused)
    const over: State = { ...show, status: "over" }
    expect(reducer(over, { type: "press", pad: 0 })).toBe(over)
  })

  test("growing the sequence to WIN_LEN wins", () => {
    // 19 pads on the board; the player has 18 right so far and finishes.
    const seq = Array.from({ length: WIN_LEN - 1 }, (_, index) => index % PADS)
    const inInput: State = {
      ...runningState(seq, "input", WIN_LEN - 1, WIN_LEN - 2),
      score: WIN_LEN - 2,
    }
    const won = reducer(inInput, { type: "press", pad: seq[WIN_LEN - 2] })
    expect(won.status).toBe("won")
    expect(won.seq).toHaveLength(WIN_LEN)
    expect(won.score).toBe(WIN_LEN - 1)
  })
})

describe("full lifecycle", () => {
  test("with a stubbed random, replay every round to WIN_LEN and win", () => {
    let state = freshGame()
    expect(state.status).toBe("running")
    expect(state.seq).toHaveLength(1)

    let rounds = 0
    while (state.status === "running") {
      // Watch the sequence light up.
      let current = state
      while (current.phase === "show") {
        current = reducer(current, { type: "step" })
      }
      expect(current.phase).toBe("input")

      // Play it back exactly.
      for (let index = 0; index < current.seq.length; index++) {
        current = reducer(current, { type: "press", pad: current.seq[index] })
      }
      state = current
      rounds++
      expect(state.phase).toBe("show")
    }

    expect(state.status).toBe("won")
    expect(state.seq).toHaveLength(WIN_LEN)
    expect(rounds).toBe(WIN_LEN - 1)
    expect(state.score).toBe(WIN_LEN - 1)
  })

  test("a full run that ends in a loss records only what was completed", () => {
    let state = freshGame()
    while (state.status === "running") {
      let current = state
      while (current.phase === "show") {
        current = reducer(current, { type: "step" })
      }
      // Fail the very first pad of the round.
      state = reducer(current, { type: "press", pad: (current.seq[0] + 1) % PADS })
    }
    expect(state.status).toBe("over")
    expect(state.score).toBe(state.seq.length - 1)
  })
})