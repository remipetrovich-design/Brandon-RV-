export declare function bookingWindowsConflict(
  start: Date | string,
  end: Date | string | null,
  existingStart: Date | string,
  existingEnd: Date | string | null,
  settings?: { booking?: { appointment_duration_minutes?: number; travel_buffer_minutes?: number } }
): boolean;
