const berlinCalendar = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });

export function berlinDate(instant: Date) {
  return new Date(berlinCalendar.format(instant) + "T00:00:00.000Z");
}

export function berlinToday() {
  return berlinDate(new Date());
}

export function activeLeaseOn(day: Date) {
  return { startsOn: { lte: day }, ...unexpiredLeaseOn(day) };
}

export function unexpiredLeaseOn(day: Date) {
  return { OR: [{ endsOn: null }, { endsOn: { gte: day } }] };
}
