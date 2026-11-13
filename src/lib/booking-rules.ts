export type BookingPolicy = {
  booking_notice_hours?: number;
  booking?: {
    working_days?: string[];
    opening_time?: string;
    closing_time?: string;
    appointment_duration_minutes?: number;
    travel_buffer_minutes?: number;
    maximum_advance_days?: number;
    unavailable_dates?: string[];
  };
};

const timezone = "Australia/Sydney";
const localParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value])) as Record<string, string>;
};

export function validateBookingWindow(start: Date, end: Date, settings: BookingPolicy, now = new Date()) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return "Enter a valid booking start and finish time.";
  const booking = settings.booking ?? {};
  const noticeHours = Math.max(1, Number(settings.booking_notice_hours ?? 24));
  if (start.getTime() < now.getTime() + noticeHours * 3600000) return "Choose a booking time at least " + noticeHours + " hours from now.";
  const maxDays = Number(booking.maximum_advance_days ?? 90);
  if (maxDays > 0 && start.getTime() > now.getTime() + maxDays * 86400000) return "Choose a date within the next " + maxDays + " days.";
  const local = localParts(start);
  const date = local.year + "-" + local.month + "-" + local.day;
  const weekday = local.weekday.slice(0, 3).toLowerCase();
  if (Array.isArray(booking.working_days) && booking.working_days.length && !booking.working_days.includes(weekday)) return "That day is outside Brandon RV's configured working days.";
  if (Array.isArray(booking.unavailable_dates) && booking.unavailable_dates.includes(date)) return "Brandon RV is unavailable on that date. Please choose another day.";
  const startMinutes = Number(local.hour) * 60 + Number(local.minute);
  const endLocal = localParts(end);
  const endMinutes = Number(endLocal.hour) * 60 + Number(endLocal.minute);
  const toMinutes = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };
  if (booking.opening_time && startMinutes < toMinutes(booking.opening_time)) return "That time is before Brandon RV's configured opening time.";
  if (booking.closing_time && (endLocal.year !== local.year || endLocal.month !== local.month || endLocal.day !== local.day || endMinutes > toMinutes(booking.closing_time))) return "That booking finishes outside Brandon RV's configured operating hours.";
  return null;
}

export function bookingTravelBuffer(settings: BookingPolicy) {
  return Math.max(0, Number(settings.booking?.travel_buffer_minutes ?? 30));
}
