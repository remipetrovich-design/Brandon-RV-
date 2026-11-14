export type BookingPolicy = {
  booking_notice_hours?: number;
  booking?: {
    working_days?: string[];
    appointment_duration_minutes?: number;
    travel_buffer_minutes?: number;
    maximum_advance_days?: number;
    unavailable_dates?: string[];
  };
};

const localParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day"), weekday: value("weekday") };
};

export function validateBookingWindow(start: Date, end: Date | null, settings: BookingPolicy, now = new Date(), bypassRestrictions = false) {
  if (!Number.isFinite(start.getTime()) || (end !== null && (!Number.isFinite(end.getTime()) || end <= start))) return "Enter a valid booking start time.";
  if (bypassRestrictions) return null;
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
  return null;
}

export function bookingTravelBuffer(settings: BookingPolicy) {
  return Math.max(0, Number(settings.booking?.travel_buffer_minutes ?? 30));
}
