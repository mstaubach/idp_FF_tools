// Sleeper league / roster / draft / user IDs are numeric strings. Validating
// before interpolating a value into a request URL keeps malformed input — extra
// path segments, query strings, encoded characters — from altering the upstream
// call or triggering pointless Sleeper requests. This is shell-level input
// validation, deliberately shared rather than living inside either tool's
// (intentionally separate) Sleeper client.
export function isValidSleeperId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && value.length > 0 && /^[0-9]+$/.test(value);
}
