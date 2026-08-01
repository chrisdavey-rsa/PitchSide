const KEY = "pitchside_skip_lock_confirm";

export function shouldSkipLockConfirm(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSkipLockConfirm(skip: boolean): void {
  try {
    if (skip) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
