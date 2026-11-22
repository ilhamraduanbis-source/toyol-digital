/** Pure timer state in whole displayed seconds and normalized unspent time. */
export function timerState(deadline, now, turnMs = 30_000) {
  if (deadline == null || !Number.isFinite(deadline) || !Number.isFinite(now)) {
    return { seconds: null, fraction: 0, warning: false }
  }
  const duration = Number.isFinite(turnMs) && turnMs > 0 ? turnMs : 30_000
  const msLeft = Math.max(0, Math.min(duration, deadline - now))
  const seconds = Math.ceil(msLeft / 1_000)
  return {
    seconds,
    fraction: msLeft / duration,
    warning: seconds <= 10,
  }
}

/** A single stable DOM node; no timer ever sends or authorizes a game action. */
export function renderTimer(mount, view, ctx, now = Date.now()) {
  const document = mount.ownerDocument
  let timer = mount.querySelector('[data-ll-timer]')
  if (!timer) {
    timer = document.createElement('div')
    timer.dataset.llTimer = ''
    timer.setAttribute('role', 'timer')
    timer.setAttribute('aria-label', 'Seconds remaining in this turn')
    mount.append(timer)
  }
  let label = timer.querySelector('[data-ll-timer-seconds]')
  if (!label) {
    label = document.createElement('span')
    label.dataset.llTimerSeconds = ''
    label.setAttribute('aria-live', 'off')
    timer.append(label)
  }
  const running = view?.phase !== 'ended' && Number.isFinite(view?.deadline)
  const state = running ? timerState(view.deadline, now) : timerState(null, now)
  timer.dataset.warning = String(state.warning)
  timer.style.setProperty('--ll-timer-fraction', String(state.fraction))
  timer.setAttribute('aria-valuemin', '0')
  timer.setAttribute('aria-valuemax', '30')
  timer.setAttribute('aria-valuenow', String(state.seconds ?? 0))
  const text = running ? String(state.seconds) + 's' : ''
  if (label.textContent !== text) label.textContent = text
  timer.hidden = !running
}
