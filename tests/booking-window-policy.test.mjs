import test from "node:test";
import assert from "node:assert/strict";
import {bookingWindowsConflict} from "../src/lib/booking-window-policy.mjs";

test("an open-ended booking reserves the configured duration without storing a finish",()=>{
 const settings={booking:{appointment_duration_minutes:60,travel_buffer_minutes:0}};
 assert.equal(bookingWindowsConflict(new Date("2026-11-15T09:00:00Z"),null,new Date("2026-11-15T09:30:00Z"),null,settings),true);
 assert.equal(bookingWindowsConflict(new Date("2026-11-15T09:00:00Z"),null,new Date("2026-11-15T10:30:00Z"),null,settings),false);
});

test("the default internal duration is sixty minutes and travel buffer is applied",()=>{
 const settings={booking:{travel_buffer_minutes:15}};
 assert.equal(bookingWindowsConflict(new Date("2026-11-15T09:00:00Z"),null,new Date("2026-11-15T10:10:00Z"),null,settings),true);
 assert.equal(bookingWindowsConflict(new Date("2026-11-15T09:00:00Z"),null,new Date("2026-11-15T10:16:00Z"),null,settings),false);
});

test("an explicit legacy end time is used only for conflict calculations",()=>{
 const settings={booking:{appointment_duration_minutes:60,travel_buffer_minutes:0}};
 assert.equal(bookingWindowsConflict(new Date("2026-11-15T09:00:00Z"),new Date("2026-11-15T09:30:00Z"),new Date("2026-11-15T09:20:00Z"),null,settings),true);
});
