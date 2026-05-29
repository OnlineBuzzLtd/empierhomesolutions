export function offLoopJobSurfaceDisabled() {
  return true;
}

export function offLoopJobSurfaceMessage(surface: string) {
  return `${surface} is hidden for the current plumbing revenue loop. Existing data is retained for export.`;
}
