export function bookingWindowsConflict(start, end, existingStart, existingEnd, settings = {}) {
  const startMs = new Date(start).getTime();
  const existingStartMs = new Date(existingStart).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(existingStartMs)) return false;

  const configuredDuration = Number(settings.booking?.appointment_duration_minutes ?? 60);
  const configuredBuffer = Number(settings.booking?.travel_buffer_minutes ?? 30);
  const durationMinutes = Number.isFinite(configuredDuration) ? Math.min(480, Math.max(15, configuredDuration)) : 60;
  const bufferMinutes = Number.isFinite(configuredBuffer) ? Math.min(240, Math.max(0, configuredBuffer)) : 30;
  const endMs = end ? new Date(end).getTime() : startMs + durationMinutes * 60000;
  const existingEndMs = existingEnd ? new Date(existingEnd).getTime() : existingStartMs + durationMinutes * 60000;
  if (!Number.isFinite(endMs) || !Number.isFinite(existingEndMs) || endMs <= startMs || existingEndMs <= existingStartMs) return false;

  const bufferMs = bufferMinutes * 60000;
  return startMs - bufferMs < existingEndMs + bufferMs &&
    endMs + bufferMs > existingStartMs - bufferMs;
}
